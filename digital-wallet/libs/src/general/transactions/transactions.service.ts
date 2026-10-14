import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, TransactionDirection, TransactionType } from '../../database/generated/prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ExchangeRatesService } from '../exchangeRates/exchange-rates.service';
import { FraudService } from '../../fraud/fraud.service';
import { lockWallets } from '../../utils/lock-wallets';
import { toDecimal } from '../../utils/money';
import { AmountDto } from './dto/amount.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { TransferDto } from './dto/transfer.dto';

const TX_OPTIONS = { maxWait: 5000, timeout: 15000 };

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: ExchangeRatesService,
    private readonly fraud: FraudService,
  ) {}

  // ---------- add funds ----------
  async depositTransactionService(userId: number, dto: AmountDto) {
    return this.singleWalletOperation(userId, dto, TransactionType.DEPOSIT);
  }

  // ---------- withdraw ----------
  async withdrawTransactionService(userId: number, dto: AmountDto) {
    return this.singleWalletOperation(userId, dto, TransactionType.WITHDRAWAL);
  }

  private async singleWalletOperation(userId: number, dto: AmountDto, type: 'DEPOSIT' | 'WITHDRAWAL') {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const inputCurrency = this.rates.normalize(dto.currency ?? wallet.currency);
    const direction = type === 'DEPOSIT' ? TransactionDirection.CREDIT : TransactionDirection.DEBIT;

    const tx = await this.prisma.$transaction(async (db) => {
      const locked = (await lockWallets(db, [wallet.id])).get(wallet.id)!;

      // the user may have changed wallet currency between our lookup and the lock
      const input = this.rates.normalize(dto.currency ?? locked.currency);
      const conv = this.rates.convert(dto.amount, input, locked.currency);
      this.assertPositive(conv.amount);
      const amountUsd = this.rates.toUsd(dto.amount, input);

      await this.fraud.assertAllowed(db, userId, locked.id, amountUsd);

      if (direction === TransactionDirection.DEBIT && locked.balance.lt(conv.amount)) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: 'Unprocessable Entity',
          code: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient funds',
          balance: locked.balance,
          currency: locked.currency,
        });
      }

      const newBalance = direction === TransactionDirection.CREDIT ? locked.balance.add(conv.amount) : locked.balance.sub(conv.amount);
      await db.wallet.update({ where: { id: locked.id }, data: { balance: newBalance } });

      return db.transaction.create({
        data: {
          reference: randomUUID(),
          walletId: locked.id,
          type,
          direction,
          amount: conv.amount,
          currency: locked.currency,
          balanceAfter: newBalance,
          originalAmount: toDecimal(dto.amount),
          originalCurrency: input,
          exchangeRate: conv.rate,
          amountUsd,
          description: dto.description,
        },
      });
    }, TX_OPTIONS);

    return this.present(tx);
  }

  // ---------- transfer ----------
  async transferTransaction(userId: number, dto: TransferDto) {
    if (!dto.recipientEmail && !dto.recipientWalletId) {
      throw new BadRequestException('provide either recipientEmail or recipientWalletId');
    }

    const sender = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!sender) throw new NotFoundException('Wallet not found');

    const recipient = await this.prisma.wallet.findFirst({
      where: dto.recipientWalletId ? { id: dto.recipientWalletId } : { user: { email: dto.recipientEmail } },
    });
    if (!recipient) throw new NotFoundException('Recipient not found');
    if (recipient.id === sender.id) throw new BadRequestException('You cannot transfer money to yourself');

    const reference = randomUUID();

    const outTx = await this.prisma.$transaction(async (db) => {
      const locks = await lockWallets(db, [sender.id, recipient.id]);
      const from = locks.get(sender.id)!;
      const to = locks.get(recipient.id)!;

      // the amount is in the sender's currency unless they said otherwise
      const input = this.rates.normalize(dto.currency ?? from.currency);
      const debit = this.rates.convert(dto.amount, input, from.currency);
      const credit = this.rates.convert(dto.amount, input, to.currency);
      this.assertPositive(debit.amount);
      this.assertPositive(credit.amount);
      const amountUsd = this.rates.toUsd(dto.amount, input);

      await this.fraud.assertAllowed(db, userId, from.id, amountUsd);

      if (from.balance.lt(debit.amount)) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: 'Unprocessable Entity',
          code: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient funds',
          balance: from.balance,
          currency: from.currency,
        });
      }

      const fromBalance = from.balance.sub(debit.amount);
      const toBalance = to.balance.add(credit.amount);
      await db.wallet.update({ where: { id: from.id }, data: { balance: fromBalance } });
      await db.wallet.update({ where: { id: to.id }, data: { balance: toBalance } });

      const out = await db.transaction.create({
        data: {
          reference,
          walletId: from.id,
          type: TransactionType.TRANSFER_OUT,
          direction: TransactionDirection.DEBIT,
          amount: debit.amount,
          currency: from.currency,
          balanceAfter: fromBalance,
          originalAmount: toDecimal(dto.amount),
          originalCurrency: input,
          exchangeRate: debit.rate,
          amountUsd,
          counterpartyWalletId: to.id,
          description: dto.description,
        },
        include: { counterpartyWallet: { select: { id: true, user: { select: { name: true, email: true } } } } },
      });

      await db.transaction.create({
        data: {
          reference,
          walletId: to.id,
          type: TransactionType.TRANSFER_IN,
          direction: TransactionDirection.CREDIT,
          amount: credit.amount,
          currency: to.currency,
          balanceAfter: toBalance,
          originalAmount: toDecimal(dto.amount),
          originalCurrency: input,
          exchangeRate: credit.rate,
          amountUsd,
          counterpartyWalletId: from.id,
          description: dto.description,
        },
      });

      return out;
    }, TX_OPTIONS);

    return this.present(outTx);
  }

  // ---------- history ----------
  async transactionHistory(userId: number, q: HistoryQueryDto) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (q.from && q.to && q.from > q.to) throw new BadRequestException('"from" must be before "to"');

    const where: Prisma.transactionWhereInput = {
      walletId: wallet.id,
      ...(q.type && { type: q.type }),
      ...(q.direction && { direction: q.direction }),
      ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } }),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { counterpartyWallet: { select: { id: true, user: { select: { name: true, email: true } } } } },
      }),
    ]);

    return {
      data: rows.map((r) => this.present(r)),
      meta: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
    };
  }

  async getTransactionById(userId: number, id: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const row = await this.prisma.transaction.findFirst({
      where: { id, walletId: wallet.id },
      include: { counterpartyWallet: { select: { id: true, user: { select: { name: true, email: true } } } } },
    });
    if (!row) throw new NotFoundException('Transaction not found');
    return this.present(row);
  }

  // ---------- helpers ----------
  private assertPositive(amount: Prisma.Decimal) {
    if (amount.lte(0)) throw new BadRequestException('Amount is too small once converted to the wallet currency');
  }

  /** Shape of a transaction in API responses (hides internal ids/columns). */
  private present(t: {
    id: number;
    reference: string;
    type: TransactionType;
    direction: TransactionDirection;
    amount: Prisma.Decimal;
    currency: string;
    balanceAfter: Prisma.Decimal;
    originalAmount: Prisma.Decimal;
    originalCurrency: string;
    exchangeRate: Prisma.Decimal;
    description: string | null;
    createdAt: Date;
    counterpartyWallet?: { id: number; user: { name: string; email: string } } | null;
  }) {
    return {
      id: t.id,
      reference: t.reference,
      type: t.type,
      direction: t.direction,
      amount: t.amount,
      currency: t.currency,
      balanceAfter: t.balanceAfter,
      originalAmount: t.originalAmount,
      originalCurrency: t.originalCurrency,
      exchangeRate: t.exchangeRate,
      description: t.description,
      counterparty: t.counterpartyWallet
        ? { walletId: t.counterpartyWallet.id, name: t.counterpartyWallet.user.name, email: t.counterpartyWallet.user.email }
        : null,
      createdAt: t.createdAt,
    };
  }
}

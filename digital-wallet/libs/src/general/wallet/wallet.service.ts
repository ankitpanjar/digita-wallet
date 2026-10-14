import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ExchangeRatesService } from '../exchangeRates/exchange-rates.service';
import { FraudService } from '../../fraud/fraud.service';
import { lockWallets } from '../../utils/lock-wallets';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: ExchangeRatesService,
    private readonly fraud: FraudService,
  ) {}

  async getWallet(userId: number) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async walletDetails(userId: number) {
    const w = await this.getWallet(userId);
    return { id: w.id, currency: w.currency, balance: w.balance, createdAt: w.createdAt, updatedAt: w.updatedAt };
  }

  /** Balance in the wallet currency, or shown in another currency with ?currency=XXX (view only). */
  async balance(userId: number, inCurrency?: string) {
    const w = await this.getWallet(userId);
    const result: Record<string, unknown> = { walletId: w.id, balance: w.balance, currency: w.currency };

    if (inCurrency) {
      const target = this.rates.normalize(inCurrency);
      const converted = this.rates.convert(w.balance, w.currency, target);
      result.converted = { balance: converted.amount, currency: target, rate: converted.rate };
    }
    return result;
  }

  async changeCurrency(userId: number, newCurrency: string) {
    const target = this.rates.normalize(newCurrency);
    const wallet = await this.getWallet(userId);

    return this.prisma.$transaction(async (tx) => {
      // re-read under lock so a deposit happening right now isn't lost
      const locked = (await lockWallets(tx, [wallet.id])).get(wallet.id)!;
      if (locked.currency === target) {
        return { id: locked.id, currency: locked.currency, balance: locked.balance };
      }

      const { amount } = this.rates.convert(locked.balance, locked.currency, target);
      const updated = await tx.wallet.update({
        where: { id: locked.id },
        data: { currency: target, balance: amount },
      });
      return { id: updated.id, currency: updated.currency, balance: updated.balance };
    });
  }

  async limits(userId: number) {
    const w = await this.getWallet(userId);
    return this.fraud.limits(w.id);
  }
}

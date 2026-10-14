import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TransactionType } from '../database/generated/prisma/client';
import { PrismaService } from '../database/prisma/prisma.service';
import { Money, toDecimal } from '../utils/money';

// Money entering or leaving because the user asked for it. The credit side of a
// transfer (TRANSFER_IN) is somebody else's action, so it doesn't count against you.
const USER_INITIATED: TransactionType[] = [
  TransactionType.DEPOSIT,
  TransactionType.WITHDRAWAL,
  TransactionType.TRANSFER_OUT,
];

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);
  readonly dailyLimitUsd: Money;
  private readonly highValueUsd: Money;
  private readonly highValueMaxCount: number;
  private readonly windowMinutes: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.dailyLimitUsd = toDecimal(config.get('DAILY_LIMIT_USD') ?? 10000);
    this.highValueUsd = toDecimal(config.get('HIGH_VALUE_THRESHOLD_USD') ?? 2000);
    this.highValueMaxCount = Number(config.get('HIGH_VALUE_MAX_COUNT') ?? 3);
    this.windowMinutes = Number(config.get('HIGH_VALUE_WINDOW_MINUTES') ?? 10);
  }

  private startOfDayUtc(): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  async usedToday(db: Prisma.TransactionClient | PrismaService, walletId: number): Promise<Money> {
    const agg = await db.transaction.aggregate({
      _sum: { amountUsd: true },
      where: { walletId, type: { in: USER_INITIATED }, createdAt: { gte: this.startOfDayUtc() } },
    });
    return toDecimal(agg._sum.amountUsd ?? 0);
  }

  /**
   * Call this inside the DB transaction, after the wallet row is locked, so two parallel
   * requests can't both slip under the limit. Throws if the operation isn't allowed.
   */
  async assertAllowed(db: Prisma.TransactionClient, userId: number, walletId: number, amountUsd: Money) {
    // 1) daily limit
    const used = await this.usedToday(db, walletId);
    if (used.add(amountUsd).gt(this.dailyLimitUsd)) {
      const remaining = Prisma.Decimal.max(this.dailyLimitUsd.sub(used), 0);
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'DAILY_LIMIT_EXCEEDED',
        message: `Daily transaction limit of ${this.dailyLimitUsd} USD exceeded`,
        dailyLimitUsd: this.dailyLimitUsd,
        usedTodayUsd: used,
        remainingUsd: remaining,
      });
    }

    // 2) velocity: too many high-value transactions in a short window
    if (amountUsd.gte(this.highValueUsd)) {
      const since = new Date(Date.now() - this.windowMinutes * 60_000);
      const recent = await db.transaction.count({
        where: {
          walletId,
          type: { in: USER_INITIATED },
          amountUsd: { gte: this.highValueUsd },
          createdAt: { gte: since },
        },
      });

      if (recent >= this.highValueMaxCount) {
        const details = `${recent} transactions of ${this.highValueUsd} USD or more in the last ${this.windowMinutes} min; blocked a new one of ${amountUsd} USD`;
        // written with the normal client on purpose: the surrounding transaction is about to
        // roll back, and we still want the alert to survive that.
        await this.prisma.fraud_alert.create({ data: { userId, rule: 'HIGH_VALUE_VELOCITY', details } });
        this.logger.warn(`Fraud alert for user ${userId}: ${details}`);
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'SUSPICIOUS_ACTIVITY',
          message: 'Too many high-value transactions in a short time. This transaction was blocked and flagged for review.',
        });
      }
    }
  }

  async limits(walletId: number) {
    const used = await this.usedToday(this.prisma, walletId);
    return {
      dailyLimitUsd: this.dailyLimitUsd,
      usedTodayUsd: used,
      remainingUsd: Prisma.Decimal.max(this.dailyLimitUsd.sub(used), 0),
      resetsAt: new Date(this.startOfDayUtc().getTime() + 24 * 3600_000),
    };
  }

  alertsFor(userId: number) {
    return this.prisma.fraud_alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, rule: true, details: true, createdAt: true },
    });
  }
}

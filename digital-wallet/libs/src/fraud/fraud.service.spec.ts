import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../database/generated/prisma/client';
import { FraudService } from './fraud.service';

const D = (v: number) => new Prisma.Decimal(v);

function build(opts: { usedToday: number; recentHighValue: number }) {
  const prisma: any = { fraud_alert: { create: jest.fn().mockResolvedValue({}) } };
  const db: any = {
    transaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountUsd: D(opts.usedToday) } }),
      count: jest.fn().mockResolvedValue(opts.recentHighValue),
    },
  };
  const service = new FraudService(new ConfigService({}), prisma);
  return { service, prisma, db };
}

describe('FraudService', () => {
  it('allows a normal transaction', async () => {
    const { service, db } = build({ usedToday: 100, recentHighValue: 0 });
    await expect(service.assertAllowed(db, 1, 1, D(50))).resolves.toBeUndefined();
  });

  it('allows reaching exactly the daily limit', async () => {
    const { service, db } = build({ usedToday: 9000, recentHighValue: 0 });
    await expect(service.assertAllowed(db, 1, 1, D(1000))).resolves.toBeUndefined();
  });

  it('blocks a transaction that would push the day over 10,000 USD', async () => {
    const { service, db } = build({ usedToday: 9500, recentHighValue: 0 });
    await expect(service.assertAllowed(db, 1, 1, D(600))).rejects.toMatchObject({
      response: { code: 'DAILY_LIMIT_EXCEEDED' },
    });
  });

  it('blocks and records an alert after 3 high-value transactions in the window', async () => {
    const { service, db, prisma } = build({ usedToday: 6000, recentHighValue: 3 });
    await expect(service.assertAllowed(db, 1, 1, D(2500))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.fraud_alert.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 1, rule: 'HIGH_VALUE_VELOCITY' }) }),
    );
  });

  it('does not apply the velocity rule to small amounts', async () => {
    const { service, db, prisma } = build({ usedToday: 6000, recentHighValue: 5 });
    await expect(service.assertAllowed(db, 1, 1, D(100))).resolves.toBeUndefined();
    expect(prisma.fraud_alert.create).not.toHaveBeenCalled();
  });
});

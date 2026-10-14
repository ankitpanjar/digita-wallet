import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../database/generated/prisma/client';
import { DEFAULT_RATES } from './default-rates';
import { ExchangeRatesService } from './exchange-rates.service';

describe('ExchangeRatesService', () => {
  let service: ExchangeRatesService;

  beforeEach(async () => {
    const prisma: any = {
      exchange_rate: {
        findMany: jest.fn().mockResolvedValue(Object.entries(DEFAULT_RATES).map(([currency, rate]) => ({ currency, rate }))),
      },
    };
    service = new ExchangeRatesService(prisma, new ConfigService({}));
    await service.loadRates();
  });

  it('returns the same amount for the same currency', () => {
    const r = service.convert(100, 'USD', 'USD');
    expect(r.amount.toString()).toBe('100');
    expect(r.rate.toString()).toBe('1');
  });

  it('converts USD to EUR using the stored rate', () => {
    expect(service.convert(100, 'USD', 'EUR').amount.toString()).toBe('92');
  });

  it('converts between two non-USD currencies via USD', () => {
    // 83.2 INR = 1 USD = 0.92 EUR  ->  832 INR = 9.2 EUR
    expect(service.convert(832, 'INR', 'EUR').amount.toString()).toBe('9.2');
  });

  it('rounds to 2 decimals', () => {
    const r = service.convert(1, 'USD', 'JPY');
    expect(r.amount.toString()).toBe('149.5');
    expect(service.convert(0.01, 'USD', 'GBP').amount.toString()).toBe('0.01');
  });

  it('computes the USD value of an amount', () => {
    expect(service.toUsd(920, 'EUR').toString()).toBe('1000');
  });

  it('normalizes currency codes and rejects unknown ones', () => {
    expect(service.normalize(' eur ')).toBe('EUR');
    expect(() => service.normalize('XYZ')).toThrow(BadRequestException);
  });

  it('round trips without losing more than a cent', () => {
    const there = service.convert(250, 'GBP', 'INR').amount;
    const back = service.convert(there, 'INR', 'GBP').amount;
    expect(back.minus(250).abs().lte(new Prisma.Decimal('0.01'))).toBe(true);
  });
});

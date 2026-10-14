import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '../../database/generated/prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { Money, round2, toDecimal } from '../../utils/money';
import { DEFAULT_RATES } from './default-rates';
import { ConvertQueryDto } from './dto/convert-query.dto';

export interface Conversion {
  amount: Money; // converted amount, rounded to 2dp
  rate: Money; // 1 unit of `from` = `rate` units of `to`
}

@Injectable()
export class ExchangeRatesService implements OnModuleInit {
  private readonly logger = new Logger(ExchangeRatesService.name);
  private rates = new Map<string, Money>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
    await this.loadRates();
    void this.refreshFromApi();
  }

  private async ensureDefaults() {
    const existing = await this.prisma.exchange_rate.findMany({ select: { currency: true } });
    const have = new Set(existing.map((r) => r.currency));
    const missing = Object.entries(DEFAULT_RATES).filter(([code]) => !have.has(code));
    if (missing.length) {
      await this.prisma.exchange_rate.createMany({
        data: missing.map(([currency, rate]) => ({ currency, rate })),
      });
    }
  }

  async loadRates() {
    const rows = await this.prisma.exchange_rate.findMany();
    this.rates = new Map(rows.map((r) => [r.currency, toDecimal(r.rate)]));
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async refreshFromApi() {
    const url = this.config.get<string>('EXCHANGE_RATE_API_URL');
    if (!url) return;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { rates?: Record<string, number> };
      if (!body.rates) throw new Error('response has no "rates" field');

      const updates = [...this.rates.keys()]
        .filter((code) => typeof body.rates![code] === 'number' && body.rates![code] > 0)
        .map((code) =>
          this.prisma.exchange_rate.update({ where: { currency: code }, data: { rate: body.rates![code] } }),
        );
      await this.prisma.$transaction(updates);
      await this.loadRates();
      this.logger.log(`Exchange rates refreshed (${updates.length} currencies)`);
    } catch (err) {
      this.logger.warn(`Could not refresh exchange rates, keeping the stored ones: ${(err as Error).message}`);
    }
  }

  supportedCurrencies(): string[] {
    return [...this.rates.keys()].sort();
  }

  normalize(code: string): string {
    const upper = code.trim().toUpperCase();
    if (!this.rates.has(upper)) {
      throw new BadRequestException(
        `Currency "${upper}" is not supported. Supported: ${this.supportedCurrencies().join(', ')}`,
      );
    }
    return upper;
  }

  private rateOf(code: string): Money {
    const rate = this.rates.get(code);
    if (!rate) throw new BadRequestException(`No exchange rate for ${code}`);
    return rate;
  }

  convert(amount: Prisma.Decimal | number | string, from: string, to: string): Conversion {
    if (from === to) return { amount: round2(amount), rate: toDecimal(1) };
    // go through USD: amount / rate[from] gives USD, * rate[to] gives target currency
    const rate = this.rateOf(to).div(this.rateOf(from)).toDecimalPlaces(8);
    return { amount: round2(toDecimal(amount).mul(rate)), rate };
  }

  /** Response for GET /exchange-rates/convert: validates both codes, then converts. */
  convertExchangeRateValue(convertQueryData: ConvertQueryDto) {
    const from = this.normalize(convertQueryData.from);
    const to = this.normalize(convertQueryData.to);
    const result = this.convert(convertQueryData.amount, from, to);
    return { from, to, amount: convertQueryData.amount, converted: result.amount, rate: result.rate };
  }

  toUsd(amount: Prisma.Decimal | number | string, from: string): Money {
    return toDecimal(amount).div(this.rateOf(from)).toDecimalPlaces(4);
  }

  async getAllExchangeRateListValue() {
    const rows = await this.prisma.exchange_rate.findMany({ orderBy: { currency: 'asc' } });
    return { base: 'USD', rates: rows.map((r) => ({ currency: r.currency, rate: r.rate, updatedAt: r.updatedAt })) };
  }
}

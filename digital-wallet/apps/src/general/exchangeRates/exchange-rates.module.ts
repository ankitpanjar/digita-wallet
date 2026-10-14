import { Module } from '@nestjs/common';
import { ExchangeRatesModule } from '@app/shared';
import { ExchangeRatesController } from './exchange-rates.controller';

@Module({
  imports: [ExchangeRatesModule],
  controllers: [ExchangeRatesController],
})
export class ExchangeRatesHttpModule {}

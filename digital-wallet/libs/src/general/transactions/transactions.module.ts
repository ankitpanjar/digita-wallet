import { Module } from '@nestjs/common';
import { ExchangeRatesModule } from '../exchangeRates/exchange-rates.module';
import { FraudModule } from '../../fraud/fraud.module';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [ExchangeRatesModule, FraudModule],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}

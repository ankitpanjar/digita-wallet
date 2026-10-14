import { Module } from '@nestjs/common';
import { ExchangeRatesModule } from '../exchangeRates/exchange-rates.module';
import { FraudModule } from '../../fraud/fraud.module';
import { WalletService } from './wallet.service';

@Module({
  imports: [ExchangeRatesModule, FraudModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}

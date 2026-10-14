import { Module } from '@nestjs/common';
import { ExchangeRatesHttpModule } from './exchangeRates/exchange-rates.module';
import { TransactionsHttpModule } from './transactions/transactions.module';
import { WalletHttpModule } from './wallet/wallet.module';

// groups the wallet-related feature modules so AppModule only imports one thing
@Module({
  imports: [WalletHttpModule, TransactionsHttpModule, ExchangeRatesHttpModule],
})
export class GeneralModule {}

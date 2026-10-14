import { Module } from '@nestjs/common';
import { WalletModule, FraudModule } from '@app/shared';
import { WalletController } from './wallet.controller';

@Module({
  imports: [WalletModule, FraudModule],
  controllers: [WalletController],
})
export class WalletHttpModule {}

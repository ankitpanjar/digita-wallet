import { Module } from '@nestjs/common';
import { TransactionsModule } from '@app/shared';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [TransactionsModule],
  controllers: [TransactionsController],
})
export class TransactionsHttpModule {}

// Public surface of the shared lib: everything the HTTP app (controllers) needs.
export * from './database/prisma/prisma.module';
export * from './database/prisma/prisma.service';
export * from './config/env.validation';
export * from './config/constants';

export * from './auth/auth.module';
export * from './auth/auth.service';
export * from './auth/dto/login.dto';
export * from './auth/dto/register.dto';

export * from './general/wallet/wallet.module';
export * from './general/wallet/wallet.service';
export * from './general/wallet/dto/change-currency.dto';

export * from './general/transactions/transactions.module';
export * from './general/transactions/transactions.service';
export * from './general/transactions/dto/amount.dto';
export * from './general/transactions/dto/history-query.dto';
export * from './general/transactions/dto/transfer.dto';

export * from './general/exchangeRates/default-rates';
export * from './general/exchangeRates/exchange-rates.module';
export * from './general/exchangeRates/exchange-rates.service';
export * from './general/exchangeRates/dto/convert-query.dto';

export * from './fraud/fraud.module';
export * from './fraud/fraud.service';

export * from './auth/auth-cookie';
export * from './common/decorators/current-user.decorator';
export * from './common/guards/user-throttler.guard';
export * from './common/throttler/throttler.config';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule, PrismaModule, LoggingInterceptor, throttlerOptions, UserThrottlerGuard, validateEnv } from '@app/shared';
import { AuthHttpModule } from './auth/auth.module';
import { GeneralModule } from './general/general.module';
import { HealthHttpModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({ inject: [ConfigService], useFactory: throttlerOptions }),
    PrismaModule,
    AuthModule,
    HealthHttpModule,
    AuthHttpModule,
    GeneralModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}

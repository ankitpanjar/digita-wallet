import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '@app/shared';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule, AuthModule],
  controllers: [AuthController],
  providers: [JwtStrategy],
})
export class AuthHttpModule {}

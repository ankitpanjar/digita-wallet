import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AuthUser, ChangeCurrencyDto, CurrentUser, FraudService, WalletService } from '@app/shared';

@ApiTags('Wallet')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletsService: WalletService,
    private readonly fraudService: FraudService,
  ) {}

  // wallet id, currency and balance
  @Get()
  @ApiOperation({ summary: 'Get wallet details' })
  walletDetails(@CurrentUser() user: AuthUser) {
    return this.walletsService.walletDetails(user.id);
  }

  // balance in the wallet currency, or converted if ?currency= is given
  @Get('balance')
  @ApiOperation({ summary: 'Get balance, optionally converted to another currency' })
  @ApiQuery({ name: 'currency', required: false, example: 'EUR' })
  balance(@CurrentUser() user: AuthUser, @Query('currency') currency?: string) {
    return this.walletsService.balance(user.id, currency);
  }

  // switches the default currency and converts the existing balance
  @Patch('currency')
  @ApiOperation({ summary: 'Change the wallet default currency (balance is converted)' })
  changeCurrency(@CurrentUser() user: AuthUser, @Body() dto: ChangeCurrencyDto) {
    return this.walletsService.changeCurrency(user.id, dto.currency);
  }

  // daily limit, amount used today and what remains (USD)
  @Get('limits')
  @ApiOperation({ summary: 'Get transaction limits and usage' })
  limits(@CurrentUser() user: AuthUser) {
    return this.walletsService.limits(user.id);
  }

  // recent suspicious-activity alerts for this user
  @Get('fraud-alerts')
  @ApiOperation({ summary: 'List fraud alerts raised for this user' })
  alerts(@CurrentUser() user: AuthUser) {
    return this.fraudService.alertsFor(user.id);
  }
}

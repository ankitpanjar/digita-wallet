import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AmountDto, AuthUser, CurrentUser, HistoryQueryDto, TransactionsService, TransferDto } from '@app/shared';

@ApiTags('Transactions')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // credits the wallet; amount may be in another currency
  @Post('deposit')
  @ApiOperation({ summary: 'Deposit money into the wallet' })
  depositTransaction(@CurrentUser() user: AuthUser, @Body() dto: AmountDto) {
    return this.transactionsService.depositTransactionService(user.id, dto);
  }

  // debits the wallet if funds and daily limit allow
  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw money from the wallet' })
  @ApiBadRequestResponse({ description: 'Insufficient funds or limit exceeded' })
  withdrawTransaction(@CurrentUser() user: AuthUser, @Body() dto: AmountDto) {
    return this.transactionsService.withdrawTransactionService(user.id, dto);
  }

  // moves money to another wallet, converting currency if they differ
  @Post('transfer')
  @ApiOperation({ summary: 'Transfer money to another wallet (by email or wallet id)' })
  @ApiBadRequestResponse({ description: 'Insufficient funds, limit exceeded or blocked by fraud check' })
  @ApiNotFoundResponse({ description: 'Recipient not found' })
  transferTransaction(@CurrentUser() user: AuthUser, @Body() dto: TransferDto) {
    return this.transactionsService.transferTransaction(user.id, dto);
  }

  // paginated history, filterable by type, direction and date
  @Get()
  @ApiOperation({ summary: 'Paginated, filterable transaction history' })
  transactionHistory(@CurrentUser() user: AuthUser, @Query() query: HistoryQueryDto) {
    return this.transactionsService.transactionHistory(user.id, query);
  }

  // one transaction, only if it belongs to this user's wallet
  @Get(':id')
  @ApiOperation({ summary: 'Get a single transaction' })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  getTransactionById(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.transactionsService.getTransactionById(user.id, id);
  }
}

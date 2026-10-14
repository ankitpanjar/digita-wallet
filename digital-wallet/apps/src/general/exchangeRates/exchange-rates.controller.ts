import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ConvertQueryDto, ExchangeRatesService } from '@app/shared';

@ApiTags('Exchange rates')
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@UseGuards(JwtAuthGuard)
@Controller('exchangeRates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  // all supported rates (base USD)
  @Get()
  @ApiOperation({ summary: 'List supported exchange rates' })
  getAllExchangeRateList() {
    return this.exchangeRatesService.getAllExchangeRateListValue();
  }

  // converts an amount from one currency to another
  @Get('convert')
  @ApiOperation({ summary: 'Convert an amount between two currencies' })
  convertExchangeRateValue(@Query() convertQueryData: ConvertQueryDto) {
    return this.exchangeRatesService.convertExchangeRateValue(convertQueryData);
  }
}

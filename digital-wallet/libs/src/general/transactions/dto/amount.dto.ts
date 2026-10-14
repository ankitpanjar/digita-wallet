import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, Length, Max, MaxLength } from 'class-validator';
import { CURRENCY_CODE_LENGTH } from '../../../config/constants';

export class AmountDto {
  @ApiProperty({ example: 150.5, description: 'Positive amount, max 2 decimal places' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000)
  amount: number;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Currency of `amount`. Defaults to your wallet currency; if different it is converted.',
  })
  @IsOptional()
  @IsString()
  @Length(CURRENCY_CODE_LENGTH, CURRENCY_CODE_LENGTH)
  currency?: string;

  @ApiPropertyOptional({ example: 'Top up' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

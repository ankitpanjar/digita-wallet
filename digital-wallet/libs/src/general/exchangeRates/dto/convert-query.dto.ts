import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsPositive, IsString, Length } from 'class-validator';
import { CURRENCY_CODE_LENGTH } from '../../../config/constants';

export class ConvertQueryDto {
  @ApiProperty({ example: 'USD', description: 'Source currency (ISO 4217)' })
  @IsString()
  @Length(CURRENCY_CODE_LENGTH, CURRENCY_CODE_LENGTH)
  from: string;

  @ApiProperty({ example: 'EUR', description: 'Target currency (ISO 4217)' })
  @IsString()
  @Length(CURRENCY_CODE_LENGTH, CURRENCY_CODE_LENGTH)
  to: string;

  @ApiProperty({ example: 100, description: 'Amount to convert' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;
}

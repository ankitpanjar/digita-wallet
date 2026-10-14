import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { CURRENCY_CODE_LENGTH } from '../../../config/constants';

export class ChangeCurrencyDto {
  @ApiProperty({ example: 'EUR', description: 'New default currency. The existing balance is converted at the current rate.' })
  @IsString()
  @Length(CURRENCY_CODE_LENGTH, CURRENCY_CODE_LENGTH)
  currency: string;
}

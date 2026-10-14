import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsPositive, ValidateIf } from 'class-validator';
import { AmountDto } from './amount.dto';

export class TransferDto extends AmountDto {
  @ApiPropertyOptional({ example: 'friend@example.com', description: 'Recipient email (use this or recipientWalletId)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @ValidateIf((o: TransferDto) => !o.recipientWalletId)
  @IsEmail({}, { message: 'provide either recipientEmail or recipientWalletId' })
  recipientEmail?: string;

  @ApiPropertyOptional({ example: 1, description: 'Recipient wallet id (use this or recipientEmail)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  recipientWalletId?: number;
}

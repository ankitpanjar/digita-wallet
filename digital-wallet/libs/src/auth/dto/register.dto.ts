import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { CURRENCY_CODE_LENGTH } from '../../config/constants';

export class RegisterDto {
  @ApiProperty({ example: 'Ankit Kumar' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'ankit@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Secret123', description: 'Min 8 chars, at least one letter and one number' })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt ignores anything past 72 bytes
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain at least one letter and one number' })
  password: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Default wallet currency (ISO 4217). Defaults to USD.' })
  @IsOptional()
  @IsString()
  @Length(CURRENCY_CODE_LENGTH, CURRENCY_CODE_LENGTH)
  currency?: string;
}

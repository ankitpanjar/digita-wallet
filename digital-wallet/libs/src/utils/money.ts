import { Prisma } from '../database/generated/prisma/client';

export type Money = Prisma.Decimal;

export const toDecimal = (value: Prisma.Decimal | number | string): Money => new Prisma.Decimal(value);

// Money is kept to 2 decimal places everywhere we show or accept it
export const round2 = (value: Prisma.Decimal | number | string): Money =>
  new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

import { NotFoundException } from '@nestjs/common';
import { Prisma } from '../database/generated/prisma/client';
import { Money, toDecimal } from './money';

export interface LockedWallet {
  id: number;
  userId: number;
  currency: string;
  balance: Money;
}

/**
 * SELECT ... FOR UPDATE on the given wallets inside a transaction.
 * Ids are sorted before locking so two opposite transfers (A->B and B->A) always take the
 * locks in the same order and can't deadlock each other.
 */
export async function lockWallets(tx: Prisma.TransactionClient, walletIds: number[]): Promise<Map<number, LockedWallet>> {
  const ids = [...new Set(walletIds)].sort((a, b) => a - b);
  const rows = await tx.$queryRaw<{ id: number; userId: number; currency: string; balance: Prisma.Decimal | number | string }[]>`
    SELECT id, userId, currency, balance FROM wallets WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;

  if (rows.length !== ids.length) throw new NotFoundException('Wallet not found');
  return new Map(rows.map((r) => [r.id, { ...r, balance: toDecimal(r.balance) }]));
}

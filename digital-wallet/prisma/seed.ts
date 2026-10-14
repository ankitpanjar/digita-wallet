import { PrismaClient } from '../libs/src/database/generated/prisma/client';
import 'dotenv/config';
import { createAdapter } from '../libs/src/database/prisma/create-adapter';
import { DEFAULT_RATES } from '../libs/src/general/exchangeRates/default-rates';

const prisma = new PrismaClient({ adapter: createAdapter() });

async function main() {
  for (const [currency, rate] of Object.entries(DEFAULT_RATES)) {
    await prisma.exchange_rate.upsert({ where: { currency }, update: {}, create: { currency, rate } });
  }
  console.log(`Seeded ${Object.keys(DEFAULT_RATES).length} exchange rates`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

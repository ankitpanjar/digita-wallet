import { PrismaMariaDb } from '@prisma/adapter-mariadb';

// Builds the MariaDB driver adapter from DATABASE_URL (mysql:// or mariadb:// both work, also for MySQL servers)
export function createAdapter(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const url = new URL(databaseUrl);
  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
  });
}

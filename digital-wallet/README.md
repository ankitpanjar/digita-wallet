# Digital Wallet API

A mini digital wallet backend built with **NestJS**, **Prisma** and **MySQL**.

Covers: registration + JWT auth, one wallet per user, deposits / withdrawals / transfers,
transaction history, multi-currency with exchange rates, daily limits + fraud detection,
per-user rate limiting, and structured request logging.

## Getting started

```bash
# 1. install
npm install

# 2. start MySQL (or point DATABASE_URL at your own server)
docker compose up -d

# 3. configure
cp .env.example .env          # then set JWT_SECRET to something long and random

# 4. create the tables and generate the Prisma client
npm run prisma:generate        # client is generated into libs/src/database/generated (needs DATABASE_URL set)
npx prisma migrate dev --name init
npm run prisma:seed           # optional: seeds default exchange rates (the app also does this on boot)

# 5. run
npm run start:dev
```

- API base URL: `http://localhost:3001/api`
- Swagger UI (try every endpoint, log in via `/auth/login` there and the cookie is used automatically): `http://localhost:3001/api/docs`
- Raw OpenAPI JSON: `http://localhost:3001/api/openapi.json`
- Tests: `npm test`
- Production: `npm run build && npm run start:prod`

> The port is currently fixed at **3001** in `apps/src/main.ts`; the `PORT` value in `.env` is validated but not used.
> `.env` is loaded at startup (via `dotenv/config` in `main.ts`), so `LOG_LEVEL` and the other settings apply even when you run the compiled build.

## Endpoints

Register/login set an httpOnly `access_token` cookie (the token is not returned in the response body); every route except auth, health and docs needs that cookie.

| Area | Method & path | What it does |
|---|---|---|
| Auth | `POST /auth/register` | Create user + wallet (`name`, `email`, `password`, optional `currency`). Sets the `access_token` cookie. |
| Auth | `POST /auth/login` | Sets the `access_token` cookie and returns the user |
| Auth | `POST /auth/logout` | Clears the `access_token` cookie |
| Auth | `GET /auth/isAuthenticated` | Authenticated user + wallet |
| Wallet | `GET /wallet` | Wallet details |
| Wallet | `GET /wallet/balance[?currency=EUR]` | Balance; optionally also shown in another currency |
| Wallet | `PATCH /wallet/currency` | Change default currency (balance is converted at the current rate) |
| Wallet | `GET /wallet/limits` | Daily limit, used today, remaining |
| Wallet | `GET /wallet/fraud-alerts` | Suspicious-activity alerts raised for you |
| Funds | `POST /transactions/deposit` | Add funds |
| Funds | `POST /transactions/withdraw` | Withdraw funds |
| Funds | `POST /transactions/transfer` | Send to another user (`recipientEmail` or `recipientWalletId`) |
| History | `GET /transactions` | Paginated history; filters: `page`, `limit`, `type`, `direction`, `from`, `to` |
| History | `GET /transactions/:id` | One transaction |
| Rates | `GET /exchangeRates` | Current rates (base USD) |
| Rates | `GET /exchangeRates/convert?from=USD&to=EUR&amount=100` | Convert an amount |
| Health | `GET /` or `GET /health` | API and database status (no auth, not rate limited) |

### Quick walkthrough

```bash
# register two users
curl -s -X POST localhost:3001/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com","password":"Secret123","currency":"USD"}'
curl -s -X POST localhost:3001/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Bob","email":"bob@example.com","password":"Secret123","currency":"EUR"}'

# log in as Alice, saving the access_token cookie
curl -s -c jar.txt -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"email":"alice@example.com","password":"Secret123"}'

# add funds, transfer to Bob (his wallet is in EUR so it gets converted), check history
curl -s -X POST localhost:3001/api/transactions/deposit  -b jar.txt -H 'Content-Type: application/json' -d '{"amount":500}'
curl -s -X POST localhost:3001/api/transactions/transfer -b jar.txt -H 'Content-Type: application/json' -d '{"amount":100,"recipientEmail":"bob@example.com"}'
curl -s localhost:3001/api/transactions -b jar.txt
```

Every transaction in the history has `type` (DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT),
`direction` (CREDIT / DEBIT), `amount`, `currency`, `balanceAfter`, the original amount/currency
and exchange rate used, the counterparty (for transfers) and `createdAt`.
Money values are returned as **strings** (e.g. `"92.00"`) so no precision is lost in JSON.

### Error responses

| Status | When |
|---|---|
| 400 | Validation failed (e.g. amount not a positive number with max 2 decimals, unsupported currency, transfer to yourself) |
| 401 | Missing, invalid or expired cookie; wrong email/password |
| 403 | `DAILY_LIMIT_EXCEEDED` or `SUSPICIOUS_ACTIVITY` (blocked by the fraud rules) |
| 404 | Recipient or transaction not found (another user's transaction also returns 404) |
| 409 | Email already registered |
| 422 | `INSUFFICIENT_FUNDS` |
| 429 | Rate limit exceeded |

Request bodies are validated strictly: unknown fields are rejected, and `amount` must be a JSON number (not a string).

## How it works

**Money.** Balances and amounts are `DECIMAL(19,4)` in MySQL and handled with Prisma's `Decimal`
(never JS floats). Amounts are accepted with up to 2 decimal places.

**Wallets & concurrency.** Each user has exactly one wallet (`userId` is unique) created together
with the user. Every balance change runs in a DB transaction that locks the wallet row(s) with
`SELECT ... FOR UPDATE` (ids locked in sorted order, so opposite transfers can't deadlock).
That keeps balances correct and the daily-limit check race-free when requests arrive in parallel.
A transfer writes two history rows (TRANSFER_OUT / TRANSFER_IN) with the same `reference`.

**Multi-currency.** Each wallet has a currency (chosen at registration, changeable via
`PATCH /wallet/currency`). Rates are stored in the `exchange_rates` table as *units per 1 USD*;
converting A to B goes through USD. Seeded currencies: USD, EUR, GBP, INR, JPY, AUD, CAD, CHF, CNY, SGD, AED. If `EXCHANGE_RATE_API_URL` is set, rates are refreshed on
startup and every 6 hours; if the API is down the stored rates keep being used.
Deposits, withdrawals and transfers accept an optional `currency` for the amount (defaults to the
wallet currency) and are converted as needed. In a transfer the amount is debited in the sender's
currency and credited in the recipient's currency.

**Limits & fraud.** Every transaction is valued in USD. Checked inside the locked transaction:
- *Daily limit* (default 10,000 USD, resets at 00:00 UTC): the sum of the day's deposits,
  withdrawals and outgoing transfers can't exceed it. Incoming transfers don't count against you.
- *Velocity rule*: if you've already made 3 transactions of 2,000 USD or more in the last
  10 minutes, the next high-value one is blocked and a `FraudAlert` is stored.

All thresholds are in `.env` (`DAILY_LIMIT_USD`, `HIGH_VALUE_THRESHOLD_USD`, `HIGH_VALUE_MAX_COUNT`,
`HIGH_VALUE_WINDOW_MINUTES`).

**Rate limiting.** `@nestjs/throttler` with two windows applied to every route: 60 requests/minute
and 1000/hour (`THROTTLE_PER_MINUTE`, `THROTTLE_PER_HOUR`). Requests with a valid token cookie are
counted per user; anonymous ones per IP. Login/register have a stricter limit (`AUTH_THROTTLE_PER_MINUTE`, default 10, and `AUTH_THROTTLE_PER_HOUR`, default 60).
Over the limit you get `429 Too Many Requests` with a `Retry-After` header.
(Behind a proxy/load balancer, enable `app.set('trust proxy', 1)` so the IP is the real client IP.
The in-memory store is per-instance; use a Redis storage if you run several instances.)

**Logging.** A global `LoggingInterceptor` logs one line per request, e.g.
`TransactionsController.deposit POST /api/transactions/deposit -> 201 14ms user=<id>`.
Expected HTTP errors (4xx) are logged as warnings; unexpected errors as errors with a stack trace.
Query strings and request bodies are never logged, since they can contain personal data.
`LOG_LEVEL` (`fatal`, `error`, `warn`, `log`, `debug`, `verbose`; default `log`) controls verbosity:
each level also enables the more severe ones, so `warn` shows only warnings, errors and fatals.

## Configuration

Set in `.env` (see `.env.example`). Values are validated at startup, so a bad config fails fast.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | required | MySQL connection string |
| `JWT_SECRET` | required | Random string, at least 32 characters |
| `JWT_EXPIRES_IN` | `1d` | Token (and cookie) lifetime |
| `DB_POOL_SIZE` | `10` | Max simultaneous DB connections |
| `LOG_LEVEL` | `log` | Log verbosity: `fatal`, `error`, `warn`, `log`, `debug`, `verbose` |
| `THROTTLE_PER_MINUTE` / `THROTTLE_PER_HOUR` | `60` / `1000` | Rate limits for all routes |
| `AUTH_THROTTLE_PER_MINUTE` / `AUTH_THROTTLE_PER_HOUR` | `10` / `60` | Stricter limits for register/login |
| `DAILY_LIMIT_USD` | `10000` | Daily transaction limit |
| `HIGH_VALUE_THRESHOLD_USD` / `HIGH_VALUE_MAX_COUNT` / `HIGH_VALUE_WINDOW_MINUTES` | `2000` / `3` / `10` | Velocity rule |
| `EXCHANGE_RATE_API_URL` | open.er-api.com | Rate source; leave empty to use only seeded rates |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE` | – | Used by `docker-compose.yml` only |

## Project layout

```
prisma/                     schema.prisma, migrations, seed.ts
apps/src/                   HTTP layer: app.module.ts, main.ts
  auth/                     auth controller, JWT strategy and guard
  health/                   health check
  general/                  wallet, transactions and exchangeRates controllers + modules
libs/src/                   business logic, imported as @app/shared
  auth/                     register/login logic, DTOs, auth cookie helpers
  general/
    wallet/                 balance, currency change, limits
    transactions/           deposit, withdraw, transfer, history
    exchangeRates/          rate storage, refresh job, conversion
  fraud/                    daily limit + velocity rules
  database/
    prisma/                 Prisma service + MariaDB adapter
    generated/              generated Prisma client (git-ignored)
  common/                   CurrentUser decorator, per-user throttler guard, request logging
                            (logging interceptor, LOG_LEVEL parsing)
  config/                   environment validation
  utils/                    money helpers, wallet row-locking
```

## Ideas for next steps

Idempotency keys on money endpoints, a refresh-token flow, an admin role to review fraud alerts,
and a Redis store for the throttler.

import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';

const MINUTE = 60_000;
const HOUR = 3_600_000;

// Applies to every route. Two windows: a short one against bursts, a long one against sustained abuse.
export function throttlerOptions(config: ConfigService): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: 'minute', ttl: MINUTE, limit: config.get<number>('THROTTLE_PER_MINUTE', 60) },
      { name: 'hour', ttl: HOUR, limit: config.get<number>('THROTTLE_PER_HOUR', 1000) },
    ],
    errorMessage: 'Too many requests, please slow down and try again shortly',
  };
}

// Decorators are evaluated at import time, before ConfigModule has loaded .env, so the limit is
// a function that is resolved on each request instead.
const fromEnv = (key: string, fallback: number) => () => Number(process.env[key] ?? fallback);

// Register/login are open to anyone, so they get a much tighter limit (brute-force protection).
// Use as @Throttle(AUTH_THROTTLE).
export const AUTH_THROTTLE = {
  minute: { limit: fromEnv('AUTH_THROTTLE_PER_MINUTE', 10), ttl: MINUTE },
  hour: { limit: fromEnv('AUTH_THROTTLE_PER_HOUR', 60), ttl: HOUR },
};

// Validates environment variables once at startup so a bad config fails fast with a clear message,
// instead of surfacing later as a confusing runtime error. Returned values replace the raw strings.
const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;
const NUMBERS = [
  'PORT',
  'DB_POOL_SIZE',
  'THROTTLE_PER_MINUTE',
  'THROTTLE_PER_HOUR',
  'AUTH_THROTTLE_PER_MINUTE',
  'AUTH_THROTTLE_PER_HOUR',
  'DAILY_LIMIT_USD',
  'HIGH_VALUE_THRESHOLD_USD',
  'HIGH_VALUE_MAX_COUNT',
  'HIGH_VALUE_WINDOW_MINUTES',
] as const;

export function validateEnv(config: Record<string, unknown>) {
  const errors: string[] = [];

  for (const key of REQUIRED) {
    if (!config[key]) errors.push(`${key} is required`);
  }

  const secret = String(config.JWT_SECRET ?? '');
  if (secret && (secret.length < 32 || secret.startsWith('change-me'))) {
    errors.push('JWT_SECRET must be a random string of at least 32 characters (see .env.example)');
  }

  for (const key of NUMBERS) {
    const value = config[key];
    if (value !== undefined && value !== '' && !(Number.isFinite(Number(value)) && Number(value) > 0)) {
      errors.push(`${key} must be a positive number`);
    }
  }

  if (errors.length) throw new Error(`Invalid environment configuration:\n - ${errors.join('\n - ')}`);
  return config;
}

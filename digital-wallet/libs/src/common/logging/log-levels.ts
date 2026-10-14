import { LogLevel } from '@nestjs/common';

const ORDER: LogLevel[] = ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];

/** LOG_LEVEL=warn enables fatal/error/warn; defaults to 'log' (everything except debug/verbose). */
export function resolveLogLevels(level = process.env.LOG_LEVEL): LogLevel[] {
  const idx = ORDER.indexOf((level ?? 'log').toLowerCase() as LogLevel);
  return ORDER.slice(0, (idx === -1 ? ORDER.indexOf('log') : idx) + 1);
}

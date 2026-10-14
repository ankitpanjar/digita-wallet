import { ConfigService } from '@nestjs/config';
import { CookieOptions } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';

export function accessTokenCookieOptions(config: ConfigService, expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true, // not readable from JS, so XSS can't steal the token
    secure: config.get('NODE_ENV') === 'production',
    sameSite: 'lax',
    path: '/',
    ...(expiresAt && { expires: expiresAt }),
  };
}

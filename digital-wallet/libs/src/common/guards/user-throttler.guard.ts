import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ACCESS_TOKEN_COOKIE } from '../../auth/auth-cookie';

/**
 * Rate limits per user instead of per IP when a valid token cookie is sent
 * (so a whole office behind one IP doesn't share a single bucket).
 * Anonymous calls (login/register) fall back to the client IP.
 *
 * This guard runs before the route's JwtAuthGuard, so we verify the token here ourselves
 * rather than trusting the claims.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  @Inject(JwtService) private readonly jwt: JwtService;

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const token: string | undefined = req.cookies?.[ACCESS_TOKEN_COOKIE];
    if (token) {
      try {
        const payload = this.jwt.verify<{ sub: string }>(token);
        return `user:${payload.sub}`;
      } catch {
        // bad or expired token – the auth guard will reject it, throttle by IP meanwhile
      }
    }
    return `ip:${req.ip}`;
  }
}

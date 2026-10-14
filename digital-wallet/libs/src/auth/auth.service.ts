import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../database/generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma/prisma.service';
import { ExchangeRatesService } from '../general/exchangeRates/exchange-rates.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly rates: ExchangeRatesService,
  ) {}

  async register(dto: RegisterDto) {
    const currency = this.rates.normalize(dto.currency ?? 'USD');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      // user and wallet are created together, so nobody ever ends up without a wallet
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email,
          passwordHash,
          wallet: { create: { currency } },
        },
        include: { wallet: true },
      });

      return {
        user: this.publicUser(user),
        wallet: this.publicWallet(user.wallet!),
        ...(await this.signToken(user.id, user.email)),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // same error for "no such user" and "wrong password" so we don't leak which emails exist
    const ok = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');

    return { user: this.publicUser(user), ...(await this.signToken(user.id, user.email)) };
  }

  async isUserAuthenticated(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { wallet: true } });
    return { ...this.publicUser(user), wallet: user.wallet ? this.publicWallet(user.wallet) : null };
  }

  private async signToken(userId: number, email: string) {
    const accessToken = await this.jwt.signAsync({ sub: String(userId), email });
    return { accessToken };
  }

  private publicUser(u: { id: number; name: string; email: string; createdAt: Date }) {
    return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt };
  }

  private publicWallet(w: { id: number; currency: string; balance: Prisma.Decimal }) {
    return { id: w.id, currency: w.currency, balance: w.balance };
  }
}

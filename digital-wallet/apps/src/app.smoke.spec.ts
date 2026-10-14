import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser = require('cookie-parser');
import request = require('supertest');
import { AppModule } from './app.module';
import { DEFAULT_RATES, PrismaService } from '@app/shared';

// Boots the whole Nest app with a fake Prisma to check wiring, validation, auth and throttling.
// (Money logic is covered in the service specs; run the real flow against MySQL as in the README.)
describe('App smoke test', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
    const fakePrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      exchange_rate: {
        findMany: jest.fn().mockResolvedValue(Object.entries(DEFAULT_RATES).map(([currency, rate]) => ({ currency, rate }))),
        createMany: jest.fn(),
      },
    };
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(() => app.close());

  it('rejects protected routes without a token', async () => {
    await request(app.getHttpServer()).get('/api/wallet/balance').expect(401);
    await request(app.getHttpServer()).post('/api/transactions/deposit').send({ amount: 5 }).expect(401);
  });

  it('rejects a forged token', async () => {
    await request(app.getHttpServer()).get('/api/auth/isAuthenticated').set('Cookie', 'access_token=not.a.token').expect(401);
  });

  it('validates registration input', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'A', email: 'nope', password: 'short', hack: true })
      .expect(400);
    expect(JSON.stringify(res.body.message)).toContain('email');
  });

  it('unknown login returns 401', async () => {
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'a@b.com', password: 'whatever1' }).expect(401);
  });

  it('throttles the auth endpoints after 10 requests a minute', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'x@y.com', password: 'whatever1' });
      codes.push(res.status);
    }
    expect(codes.slice(-1)[0]).toBe(429);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
  });
});

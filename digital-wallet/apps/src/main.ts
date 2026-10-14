import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Request, Response } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { apiReference } from '@scalar/nestjs-api-reference';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression = require('compression');
import cookieParser = require('cookie-parser');
import { resolveLogLevels } from '@app/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: resolveLogLevels() });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.disable('x-powered-by'); // don't advertise the framework
  app.use(compression()); // gzip responses (history lists, the OpenAPI doc, Scalar)
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // ...and complain about them
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Digital Wallet API')
    .setDescription('Mini digital wallet: auth, wallets, transfers, multi-currency, fraud checks and rate limiting')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // raw OpenAPI JSON at /api/openapi.json, rendered with Scalar at /api/docs
  app.getHttpAdapter().get('/api/openapi.json', (_req: Request, res: Response) => res.json(document));
  app.use('/api/docs', apiReference({ content: document, theme: 'default' }));
  await app.listen(3001);
  new Logger('Bootstrap').log('Digital Wallet API listening on port 3001 (docs at /api/docs)');
}

bootstrap();

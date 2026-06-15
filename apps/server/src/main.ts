import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ZodValidationPipe());
  // The ws adapter handles the `/ws` gateway with a `{ event, data }` envelope.
  // The gateway sets its own `path: '/ws'`, so it never collides with the SPA
  // static fallback or the /api routes.
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();

  await app.listen(env.port, '0.0.0.0');
  Logger.log(`Voids server listening on http://0.0.0.0:${env.port}`, 'Bootstrap');
}

void bootstrap();

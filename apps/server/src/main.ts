import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  await app.listen(env.port, '0.0.0.0');
  Logger.log(`Voids server listening on http://0.0.0.0:${env.port}`, 'Bootstrap');
}

void bootstrap();

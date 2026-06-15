import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { LogLevel, NestApplicationOptions } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { RedactingLogger } from './common/redacting-logger';
import { ensureTlsMaterial } from './common/tls';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  // Global secret-redaction logger: every Logger call is scrubbed before output.
  const logger = new RedactingLogger();
  logger.setLogLevels(logLevelsFor(env.logLevel));

  const options: NestApplicationOptions = { logger };

  // Optional TLS: generate/load a fresh self-signed cert under DATA_DIR/tls.
  if (env.tls === 'on') {
    const { cert, key } = await ensureTlsMaterial(env.dataDir);
    options.httpsOptions = { cert, key };
  }

  const app = await NestFactory.create(AppModule, options);
  app.useLogger(logger);
  app.useGlobalPipes(new ZodValidationPipe());
  // The ws adapter handles the `/ws` gateway with a `{ event, data }` envelope.
  // The gateway sets its own `path: '/ws'`, so it never collides with the SPA
  // static fallback or the /api routes. Under HTTPS, NestFactory's httpsOptions
  // make the underlying server https, and the WsAdapter upgrades on that server,
  // so WS works over wss transparently.
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();

  await app.listen(env.port, '0.0.0.0');
  const scheme = env.tls === 'on' ? 'https' : 'http';
  Logger.log(
    `Voids server listening on ${scheme}://0.0.0.0:${env.port} ` +
      `(auth=${env.authMode}, tls=${env.tls})`,
    'Bootstrap',
  );
}

/**
 * Map LOG_LEVEL to the set of enabled Nest log levels (a level enables itself
 * and everything more severe). Unknown values fall back to the standard `log`.
 */
function logLevelsFor(level: string): LogLevel[] {
  const order: LogLevel[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];
  const idx = order.indexOf(level as LogLevel);
  const start = idx === -1 ? order.indexOf('log') : idx;
  return order.slice(start);
}

void bootstrap();

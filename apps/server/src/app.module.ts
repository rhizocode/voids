import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { ConfigSettingsModule } from './config/config.module';
import { LibraryModule } from './library/library.module';
import { SearchModule } from './search/search.module';
import { RssModule } from './rss/rss.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ScheduleModule } from './schedule/schedule.module';

// The built web SPA lives at apps/web/dist. Resolve relative to this file so it
// works from src (dev) and dist (production: dist/app.module.js -> ../../web/dist).
const webRoot = join(__dirname, '..', '..', 'web', 'dist');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    HealthModule,
    ConfigSettingsModule,
    NotificationsModule,
    LibraryModule,
    SearchModule,
    RssModule,
    RealtimeModule,
    ScheduleModule,
    ServeStaticModule.forRoot({
      rootPath: webRoot,
      // Keep API, WebSocket, and RSS routes out of the SPA fallback.
      exclude: ['/api/{*splat}', '/ws/{*splat}', '/rss/{*splat}'],
    }),
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { SettingsModule } from '../config/settings.module';
import { TmdbClient } from './tmdb.client';
import { TmdbCacheService } from './tmdb-cache.service';

@Module({
  imports: [SettingsModule],
  providers: [TmdbClient, TmdbCacheService],
  exports: [TmdbClient, TmdbCacheService],
})
export class TmdbModule {}

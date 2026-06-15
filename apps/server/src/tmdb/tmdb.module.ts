import { Module } from '@nestjs/common';
import { TmdbClient } from './tmdb.client';

@Module({
  providers: [TmdbClient],
  exports: [TmdbClient],
})
export class TmdbModule {}

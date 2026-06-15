import { Module } from '@nestjs/common';
import { TmdbModule } from '../tmdb/tmdb.module';
import { MovieRepository } from '../db/repositories/movie.repository';
import { MislabeledService } from './mislabeled.service';
import { MislabeledController } from './mislabeled.controller';

/**
 * Mislabeled detection (brief §5): compares owned media-server titles against
 * canonical TMDB titles via the cache-first `TmdbCacheService`.
 */
@Module({
  imports: [TmdbModule],
  controllers: [MislabeledController],
  providers: [MislabeledService, MovieRepository],
})
export class MislabeledModule {}

import { Module, forwardRef } from '@nestjs/common';
import { TmdbModule } from '../tmdb/tmdb.module';
import { SettingsModule } from '../config/settings.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MovieRepository } from '../db/repositories/movie.repository';
import { SearchJobRepository } from '../db/repositories/search-job.repository';
import { SearchService } from './search.service';
import { JobRunnerService } from './job-runner.service';
import { SearchController } from './search.controller';

@Module({
  imports: [TmdbModule, SettingsModule, forwardRef(() => RealtimeModule)],
  controllers: [SearchController],
  providers: [SearchService, JobRunnerService, MovieRepository, SearchJobRepository],
  exports: [JobRunnerService, SearchService, MovieRepository, SearchJobRepository],
})
export class SearchModule {}

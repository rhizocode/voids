import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { MediaModule } from '../media/media.module';
import { SettingsModule } from '../config/settings.module';
import { LibraryModule } from '../library/library.module';
import { SearchModule } from '../search/search.module';
import { ServerRepository } from '../db/repositories/server.repository';
import { SchedulerService } from './scheduler.service';
import { SearchAllTask } from './search-all.task';
import { ScheduleController } from './schedule.controller';
import { MovieStatusController } from './movie-status.controller';

/**
 * Automation module (brief §3/§4): the cron scheduler + the full `SearchAllTask`
 * + schedule/movie-status endpoints. `NestScheduleModule.forRoot()` provides the
 * `SchedulerRegistry` used to register the single data-driven cron job.
 */
@Module({
  imports: [
    NestScheduleModule.forRoot(),
    MediaModule,
    SettingsModule,
    LibraryModule,
    SearchModule,
  ],
  controllers: [ScheduleController, MovieStatusController],
  providers: [SchedulerService, SearchAllTask, ServerRepository],
  exports: [SchedulerService, SearchAllTask],
})
export class ScheduleModule {}

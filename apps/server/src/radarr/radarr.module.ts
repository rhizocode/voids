import { Module } from '@nestjs/common';
import { SettingsModule } from '../config/settings.module';
import { MovieRepository } from '../db/repositories/movie.repository';
import { RadarrClient } from './radarr.client';
import { RadarrService } from './radarr.service';
import { RadarrController } from './radarr.controller';

/**
 * Radarr integration (brief §6.3, §13.4): client + cross-check/push service +
 * REST endpoints. `RadarrService` is exported so the scheduled `SearchAllTask`
 * can auto-push approved recommendations.
 */
@Module({
  imports: [SettingsModule],
  controllers: [RadarrController],
  providers: [RadarrClient, RadarrService, MovieRepository],
  exports: [RadarrService],
})
export class RadarrModule {}

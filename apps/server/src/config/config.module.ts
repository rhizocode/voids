import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { TmdbModule } from '../tmdb/tmdb.module';
import { ServerRepository } from '../db/repositories/server.repository';
import { SettingsModule } from './settings.module';
import { ServersService } from './servers.service';
import { SettingsController } from './settings.controller';
import { TmdbController } from './tmdb.controller';
import { ServersController } from './servers.controller';

@Module({
  imports: [MediaModule, TmdbModule, SettingsModule],
  controllers: [SettingsController, TmdbController, ServersController],
  providers: [ServersService, ServerRepository],
  exports: [SettingsModule],
})
export class ConfigSettingsModule {}

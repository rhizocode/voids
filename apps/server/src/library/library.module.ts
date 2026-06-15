import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SettingsModule } from '../config/settings.module';
import { ServerRepository } from '../db/repositories/server.repository';
import { MovieRepository } from '../db/repositories/movie.repository';
import { LibraryService } from './library.service';
import { LibraryController } from './library.controller';

@Module({
  imports: [MediaModule, SettingsModule],
  controllers: [LibraryController],
  providers: [LibraryService, ServerRepository, MovieRepository],
  exports: [LibraryService],
})
export class LibraryModule {}

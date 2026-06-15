import { Module } from '@nestjs/common';
import { MovieRepository } from '../db/repositories/movie.repository';
import { ServerRepository } from '../db/repositories/server.repository';
import { RssService } from './rss.service';
import { RssController, RssFeedController } from './rss.controller';

@Module({
  controllers: [RssFeedController, RssController],
  providers: [RssService, MovieRepository, ServerRepository],
  exports: [RssService],
})
export class RssModule {}

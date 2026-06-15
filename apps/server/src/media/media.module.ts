import { Module } from '@nestjs/common';
import { JellyfinClient } from './jellyfin.client';
import { MediaSourceRegistry } from './media-source.registry';

@Module({
  providers: [JellyfinClient, MediaSourceRegistry],
  exports: [MediaSourceRegistry],
})
export class MediaModule {}

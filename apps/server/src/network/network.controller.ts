import { Body, Controller, Get, Put } from '@nestjs/common';
import type { NetworkSettings } from '@voids/shared';
import { SettingsService } from '../config/settings.service';
import { UpdateNetworkDto } from './network.dto';

/**
 * Network timeout settings. These feed the media / TMDB / Radarr HTTP clients
 * (see SettingsService consumers), making the UI's Network tab meaningful.
 */
@Controller('api/network')
export class NetworkController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): NetworkSettings {
    const s = this.settings.get();
    return { connectTimeoutMs: s.connectTimeoutMs, readTimeoutMs: s.readTimeoutMs };
  }

  @Put()
  update(@Body() body: UpdateNetworkDto): NetworkSettings {
    const s = this.settings.update({
      connectTimeoutMs: body.connectTimeoutMs,
      readTimeoutMs: body.readTimeoutMs,
    });
    return { connectTimeoutMs: s.connectTimeoutMs, readTimeoutMs: s.readTimeoutMs };
  }
}

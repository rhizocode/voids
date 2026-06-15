import { Body, Controller, Post, Put } from '@nestjs/common';
import { Payload, type TmdbKeyResponse } from '@voids/shared';
import { TmdbClient } from '../tmdb/tmdb.client';
import { SettingsService } from './settings.service';
import { TmdbKeyDto } from './dto';

@Controller('api/tmdb')
export class TmdbController {
  constructor(
    private readonly tmdb: TmdbClient,
    private readonly settings: SettingsService,
  ) {}

  @Put('test')
  async test(@Body() body: TmdbKeyDto): Promise<TmdbKeyResponse> {
    const valid = await this.tmdb.validateKey(body.apiKey);
    return valid ? { ...Payload.TMDB_KEY_VALID } : { ...Payload.TMDB_KEY_INVALID };
  }

  @Post('key')
  save(@Body() body: TmdbKeyDto): TmdbKeyResponse {
    this.settings.setTmdbApiKey(body.apiKey);
    return { ...Payload.TMDB_KEY_SAVE_SUCCESSFUL };
  }
}

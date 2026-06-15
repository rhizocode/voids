import { Body, Controller, Get, Put } from '@nestjs/common';
import type { Settings } from '@voids/shared';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Settings {
    return this.settings.get();
  }

  @Put()
  update(@Body() body: UpdateSettingsDto): Settings {
    return this.settings.update(body);
  }
}

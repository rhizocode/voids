import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';

/**
 * Standalone module exporting `SettingsService` so it can be shared by the
 * config module and the TMDB module without a circular import (DbModule is
 * global, so the service only needs DB).
 */
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

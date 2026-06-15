import { Inject, Injectable, Logger } from '@nestjs/common';
import { Payload, type PayloadResult } from '@voids/shared';
import { DB } from '../db/db.module';
import type { DbHandle } from '../db/client';
import {
  collectionCache,
  libraries,
  mediaServers,
  movieCache,
  notificationProviders,
  ownedMovies,
  recommendedMovies,
  searchJobs,
  settings as settingsTable,
} from '../db/schema';
import { SettingsService } from '../config/settings.service';
import { NotificationRepository } from '../db/repositories/notification.repository';

/**
 * The documented destructive reset (was Gaps' "nuke"). Wipes every app-data
 * table, clears the settings row, then re-seeds so the app stays consistent:
 * settings defaults are re-created and the 7 notification providers re-seeded.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Inject(DB) private readonly handle: DbHandle,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationRepository,
  ) {}

  nuke(): PayloadResult {
    try {
      this.handle.db.transaction((tx) => {
        tx.delete(searchJobs).run();
        tx.delete(recommendedMovies).run();
        tx.delete(ownedMovies).run();
        tx.delete(libraries).run();
        tx.delete(mediaServers).run();
        tx.delete(movieCache).run();
        tx.delete(collectionCache).run();
        tx.delete(notificationProviders).run();
        // Reset the single settings row to defaults by deleting it; SettingsService
        // re-seeds on next read.
        tx.delete(settingsTable).run();
      });

      // Re-seed so the app is immediately consistent: settings defaults + the
      // 7 notification providers.
      this.settings.get();
      this.notifications.seed();

      this.logger.warn('Nuke completed: all app data wiped and defaults re-seeded.');
      return { ...Payload.NUKE_SUCCESSFUL };
    } catch (err) {
      this.logger.error('Nuke failed', err as Error);
      return { ...Payload.NUKE_UNSUCCESSFUL };
    }
  }
}

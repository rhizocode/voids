import { Injectable, Logger } from '@nestjs/common';
import type { NotificationType } from '@voids/shared';

/** Severity of a notification, mapped to provider-specific styling in Phase 5. */
export type NotificationLevel = 'info' | 'warn' | 'error';

/**
 * Notification HOOK POINT (brief §11; Phase 4 builds the seam, Phase 5 fills it).
 *
 * Phase 5 will implement the 7 providers (Telegram, PushBullet, Slack, Gotify,
 * Email, PushOver, Discord), per-provider subscription filtering, config, and
 * fan-out — all behind this exact `notify(...)` signature, which MUST stay
 * stable so callers (SearchAllTask, SearchService) never change.
 *
 * For now `notify` just logs at the appropriate level. Callers pass only
 * non-sensitive title/body strings; never pass secrets (tokens, keys) here.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * Dispatch a notification. In Phase 5 this fans out to enabled providers
   * filtered by their subscribed `NotificationType`s (`TEST` bypasses the
   * filter). Today it logs only.
   */
  async notify(
    type: NotificationType,
    level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void> {
    const line = `[notify] ${type} :: ${title} — ${body}`;
    switch (level) {
      case 'error':
        this.logger.error(line);
        break;
      case 'warn':
        this.logger.warn(line);
        break;
      default:
        this.logger.log(line);
        break;
    }
    return Promise.resolve();
  }
}

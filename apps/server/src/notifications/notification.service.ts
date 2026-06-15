import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  NotificationType,
  Payload,
  type NotificationConfig,
  type NotificationProviderConfig,
  type NotificationProviderId,
  type ProviderTestResult,
  type TestResult,
} from '@voids/shared';
import { NotificationRepository } from '../db/repositories/notification.repository';
import type { NotificationProvider } from './providers';
import { NOTIFICATION_PROVIDERS } from './notification.tokens';

/** Severity of a notification, mapped to provider-specific styling. */
export type NotificationLevel = 'info' | 'warn' | 'error';

/**
 * Notification fan-out (brief §11). `notify(type, level, title, body)` is the
 * stable seam every caller (SearchAllTask, SearchService) uses; its signature
 * MUST NOT change.
 *
 * On `notify`: load every ENABLED provider, include it when `type` is in its
 * subscribed `notificationTypes` (EXCEPT `TEST`, which always sends), and
 * dispatch concurrently. A single provider's failure is caught + logged and
 * never propagates, so a search/schedule run is never broken by a flaky
 * provider. Secrets are never logged.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly byId = new Map<number, NotificationProvider>();

  constructor(
    private readonly repo: NotificationRepository,
    @Inject(NOTIFICATION_PROVIDERS) providers: NotificationProvider[],
  ) {
    for (const p of providers) this.byId.set(p.id, p);
  }

  /**
   * Dispatch a notification to every subscribed, enabled provider. `TEST`
   * bypasses the subscription filter. Always resolves (failures are logged).
   */
  async notify(
    type: NotificationType,
    level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void> {
    let targets: NotificationProviderConfig[];
    try {
      targets = this.repo.listEnabled().filter((p) => this.subscribed(p, type));
    } catch (err) {
      this.logger.error(
        `Failed to load notification providers: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    await Promise.all(
      targets.map((cfg) =>
        this.dispatch(cfg, type, level, title, body).catch((err: unknown) => {
          // Catch per provider so one failure never breaks the others or the run.
          this.logger.warn(
            `Provider ${cfg.id} (${cfg.name}) failed to send ${type}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }),
      ),
    );
  }

  /**
   * Test a single provider: send a `TEST` notification (bypasses the type
   * filter) and report `NOTIFICATION_TEST_SUCCEEDED(70)` / `FAILED(71)`.
   */
  async test(id: NotificationProviderId): Promise<TestResult> {
    const cfg = this.repo.find(id);
    if (!cfg) {
      return { ...Payload.NOTIFICATION_TEST_FAILED, reason: `No provider ${id}.` };
    }
    try {
      await this.dispatch(
        cfg,
        NotificationType.TEST,
        'info',
        'Voids test notification',
        'This is a test notification from Voids. If you can read this, it works.',
      );
      return { ...Payload.NOTIFICATION_TEST_SUCCEEDED };
    } catch (err) {
      const reason = err instanceof Error ? err.message : Payload.NOTIFICATION_TEST_FAILED.reason;
      this.logger.warn(`Provider ${id} (${cfg.name}) test failed: ${reason}`);
      return { ...Payload.NOTIFICATION_TEST_FAILED, reason };
    }
  }

  /** Test every ENABLED provider, returning a per-provider result. */
  async testAll(): Promise<ProviderTestResult[]> {
    const enabled = this.repo.listEnabled();
    return Promise.all(
      enabled.map(async (cfg) => {
        const result = await this.test(cfg.id);
        return { id: cfg.id, ...result };
      }),
    );
  }

  /** Whether a provider is subscribed to a type (TEST always passes). */
  private subscribed(cfg: NotificationProviderConfig, type: NotificationType): boolean {
    if (type === NotificationType.TEST) return true;
    return cfg.notificationTypes.includes(type);
  }

  /** Resolve the implementation and send. Throws on send failure. */
  private async dispatch(
    cfg: NotificationProviderConfig,
    type: NotificationType,
    level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void> {
    const provider = this.byId.get(cfg.id);
    if (!provider) {
      throw new Error(`No implementation registered for provider ${cfg.id}.`);
    }
    const config = cfg.config as NotificationConfig;
    await provider.send(config, type, level, title, body);
  }
}

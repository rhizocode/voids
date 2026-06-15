import type { z } from 'zod';
import type { NotificationConfig, NotificationType } from '@voids/shared';
import type { NotificationLevel } from '../notification.service';

/**
 * A single notification provider. Each implementation owns one provider id,
 * a zod config schema (a member of the shared discriminated union), and the
 * exact outbound request (HTTP or SMTP) per gaps-reference §6.
 *
 * `send` MUST throw on failure (non-2xx, transport error) so the fan-out's
 * `test` path can report `NOTIFICATION_TEST_FAILED`. Providers must never log
 * secrets (tokens, passwords, webhook URLs).
 */
export interface NotificationProvider<C extends NotificationConfig = NotificationConfig> {
  readonly id: number;
  readonly name: string;
  /**
   * The zod schema for this provider's config (a union member). Typed loosely
   * because `.default()` fields make a schema's input type differ from its
   * output type; the controller validates against the shared discriminated
   * union, this is a per-provider reference handle.
   */
  readonly configSchema: z.ZodTypeAny;
  /** Whether this config is sufficiently populated to actually send. */
  isEnabled(config: C): boolean;
  /** Issue the provider's notification. Throws on any failure. */
  send(
    config: C,
    type: NotificationType,
    level: NotificationLevel,
    title: string,
    body: string,
  ): Promise<void>;
}

/** Shared 5s timeout for all providers (matches the original Gaps client). */
export const NOTIFICATION_TIMEOUT_MS = 5000;

/** Escape user-controlled content for Telegram HTML parse_mode (& must go first). */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escape user-controlled content for Slack mrkdwn (& must go first). */
export function escapeSlack(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * POST JSON to a URL with the shared timeout, throwing a redacted error on a
 * non-2xx response or transport failure. `label` is a safe identifier used in
 * error messages — never pass a secret or full webhook URL.
 */
export async function postJson(
  url: string,
  body: unknown,
  label: string,
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOTIFICATION_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`${label} notification failed: HTTP ${res.status}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`${label} notification timed out after ${NOTIFICATION_TIMEOUT_MS}ms`);
    }
    if (err instanceof Error && err.message.includes('notification failed')) {
      throw err;
    }
    throw new Error(
      `${label} notification failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

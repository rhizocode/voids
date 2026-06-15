import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DB } from '../db/db.module';
import type { DbHandle } from '../db/client';
import { settings as settingsTable } from '../db/schema';
import { loadEnv, type AppEnv, type AuthModeEnv } from '../config/env';

const SETTINGS_ID = 1;
const BCRYPT_ROUNDS = 10;

/**
 * Boot-time auth state derived from env + persisted into the settings row.
 *
 * In `basic` mode credentials are sourced from env on boot (`AUTH_USERNAME`,
 * `AUTH_PASSWORD`): the password is bcrypt-hashed and the username+hash stored
 * in `settings` (updated when changed). If basic mode is enabled but no password
 * is configured anywhere, we LOG A CLEAR WARNING and **fail closed** — the guard
 * denies every protected request rather than silently running open.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly env: AppEnv;

  private username = 'admin';
  private passwordHash: string | null = null;
  /** True when basic mode is on but no usable password exists (deny all). */
  private failClosed = false;

  constructor(@Inject(DB) private readonly handle: DbHandle) {
    this.env = loadEnv();
  }

  get mode(): AuthModeEnv {
    return this.env.authMode;
  }

  onModuleInit(): void {
    // Persist the configured auth mode so the UI / settings reflect it.
    this.ensureSettingsRow();
    this.handle.db
      .update(settingsTable)
      .set({ authMode: this.env.authMode })
      .where(eq(settingsTable.id, SETTINGS_ID))
      .run();

    if (this.env.authMode !== 'basic') {
      this.logger.log('Auth mode: none (open access — trusted LAN)');
      return;
    }

    this.username = this.env.authUsername;

    if (!this.env.authPassword) {
      // No password anywhere. We could already have a hash from a prior boot,
      // but env is the source of truth on boot; an unset AUTH_PASSWORD means
      // the operator removed it, so fail closed.
      this.failClosed = true;
      this.passwordHash = null;
      this.logger.warn(
        'Auth mode: basic, but AUTH_PASSWORD is not set. Failing CLOSED — all ' +
          'protected requests will be denied. Set AUTH_PASSWORD to enable login.',
      );
      this.persistCredentials(this.username, null);
      return;
    }

    // Hash the env password and persist username + hash (update if changed).
    this.passwordHash = bcrypt.hashSync(this.env.authPassword, BCRYPT_ROUNDS);
    this.failClosed = false;
    this.persistCredentials(this.username, this.passwordHash);
    this.logger.log(`Auth mode: basic (user "${this.username}")`);
  }

  private ensureSettingsRow(): void {
    const existing = this.handle.db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, SETTINGS_ID))
      .get();
    if (!existing) {
      this.handle.db.insert(settingsTable).values({ id: SETTINGS_ID }).run();
    }
  }

  private persistCredentials(username: string, hash: string | null): void {
    this.handle.db
      .update(settingsTable)
      .set({ authUsername: username, authPasswordHash: hash, updatedAt: new Date() })
      .where(eq(settingsTable.id, SETTINGS_ID))
      .run();
  }

  /**
   * Validate a username/password pair using constant-time username comparison
   * and bcrypt for the password. Returns false in none-mode-misuse or
   * fail-closed states.
   */
  validate(username: string, password: string): boolean {
    if (this.env.authMode !== 'basic') return true;
    if (this.failClosed || !this.passwordHash) return false;
    if (!constantTimeEquals(username, this.username)) return false;
    return bcrypt.compareSync(password, this.passwordHash);
  }
}

/** Length-safe constant-time string comparison (avoids username timing leaks). */
function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    // Still run a compare against a same-length buffer to reduce timing signal.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

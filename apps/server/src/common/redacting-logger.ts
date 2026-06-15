import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { redactSecrets } from './redact';

/**
 * A drop-in NestJS logger that pipes every message (and any object/error
 * arguments) through {@link redactSecrets} before delegating to the standard
 * ConsoleLogger. Wiring this via `app.useLogger(new RedactingLogger())` makes
 * redaction global: every existing `Logger`/`this.logger` call across the
 * codebase is scrubbed, so a stray token or `?api_key=...` URL can never reach
 * the output. This is the enforcement point referenced in §13 ("a logging
 * redaction interceptor enforces this").
 */
export class RedactingLogger extends ConsoleLogger {
  private scrub(args: unknown[]): unknown[] {
    return args.map((a) => redactSecrets(a));
  }

  log(message: unknown, ...rest: unknown[]): void {
    super.log(redactSecrets(message), ...this.scrub(rest));
  }

  error(message: unknown, ...rest: unknown[]): void {
    super.error(redactSecrets(message), ...this.scrub(rest));
  }

  warn(message: unknown, ...rest: unknown[]): void {
    super.warn(redactSecrets(message), ...this.scrub(rest));
  }

  debug(message: unknown, ...rest: unknown[]): void {
    super.debug(redactSecrets(message), ...this.scrub(rest));
  }

  verbose(message: unknown, ...rest: unknown[]): void {
    super.verbose(redactSecrets(message), ...this.scrub(rest));
  }

  fatal(message: unknown, ...rest: unknown[]): void {
    super.fatal(redactSecrets(message), ...this.scrub(rest));
  }

  setLogLevels(levels: LogLevel[]): void {
    super.setLogLevels(levels);
  }
}

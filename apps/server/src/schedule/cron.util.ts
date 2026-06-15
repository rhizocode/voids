import { validateCronExpression } from 'cron';

/**
 * Convert a Quartz 6-field cron string (`sec min hour day-of-month month
 * day-of-week`, as used by the original Gaps presets, e.g. `0 0 4 * * ?`) into
 * the form accepted by the `cron` package that backs `@nestjs/schedule`.
 *
 * The `cron` package does NOT accept the Quartz `?` "no specific value" token,
 * but it does accept day-name tokens (`MON`, `TUE`, …). So we:
 *   1. Trim & collapse whitespace, then require exactly 6 fields.
 *   2. Replace `?` with `*` in the day-of-month (field 4) and day-of-week
 *      (field 6) positions (the only places Quartz allows `?`).
 *   3. Leave day-name tokens intact (the `cron` package understands them).
 *   4. Validate the result by parsing it; throw on clearly-invalid input.
 *
 * @throws Error when the input is not a valid 6-field expression.
 */
export function quartzToCron(q: string): string {
  if (typeof q !== 'string' || q.trim() === '') {
    throw new Error('Empty cron expression');
  }

  const fields = q.trim().split(/\s+/);
  if (fields.length !== 6) {
    throw new Error(
      `Expected a 6-field Quartz cron (sec min hour dom month dow), got ${fields.length} field(s): "${q}"`,
    );
  }

  // Quartz only permits `?` in the day-of-month (index 3) and day-of-week
  // (index 5) fields. Replace those with `*`; reject `?` anywhere else.
  const out = fields.map((field, i) => {
    if (field === '?') {
      if (i === 3 || i === 5) return '*';
      throw new Error(`"?" is only valid in the day-of-month or day-of-week field: "${q}"`);
    }
    return field;
  });

  const normalized = out.join(' ');

  // Validate with the `cron` package itself (the same parser that registers the
  // job), so anything that passes here is guaranteed to register. It accepts
  // 6-field expressions and day-name tokens (MON, TUE, …).
  const result = validateCronExpression(normalized);
  if (!result.valid) {
    const reason = result.error instanceof Error ? result.error.message : 'invalid expression';
    throw new Error(`Invalid cron expression "${q}" -> "${normalized}": ${reason}`);
  }

  return normalized;
}

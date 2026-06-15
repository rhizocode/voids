import { describe, it, expect } from 'vitest';
import { redactSecrets, REDACTED } from './redact';

describe('redactSecrets', () => {
  it('masks sensitive object keys (camelCase + snake_case + header style)', () => {
    const input = {
      token: 'super-secret',
      apiKey: 'abc123',
      api_key: 'def456',
      password: 'hunter2',
      plexToken: 'plex-xyz',
      'X-Emby-Token': 'emby-tok',
      'X-Api-Key': 'k',
      webHookUrl: 'https://hooks.example/abc',
      Authorization: 'Bearer zzz',
      botId: '123:ABC',
      keep: 'visible',
      nested: { token: 'inner-secret', value: 42 },
    };
    const out = redactSecrets(input);
    expect(out.token).toBe(REDACTED);
    expect(out.apiKey).toBe(REDACTED);
    expect(out.api_key).toBe(REDACTED);
    expect(out.password).toBe(REDACTED);
    expect(out.plexToken).toBe(REDACTED);
    expect(out['X-Emby-Token']).toBe(REDACTED);
    expect(out['X-Api-Key']).toBe(REDACTED);
    expect(out.webHookUrl).toBe(REDACTED);
    expect(out.Authorization).toBe(REDACTED);
    expect(out.botId).toBe(REDACTED);
    expect(out.keep).toBe('visible');
    expect(out.nested.token).toBe(REDACTED);
    expect(out.nested.value).toBe(42);
  });

  it('does not mutate the input object', () => {
    const input = { token: 'secret', keep: 'x' };
    redactSecrets(input);
    expect(input.token).toBe('secret');
  });

  it('redacts api_key in URL query strings', () => {
    const url = 'https://api.themoviedb.org/3/movie/603?api_key=DEADBEEF&language=en-US';
    expect(redactSecrets(url)).toBe(
      `https://api.themoviedb.org/3/movie/603?api_key=${REDACTED}&language=en-US`,
    );
  });

  it('redacts &token= and ?token= and X-Plex-Token in URLs', () => {
    expect(redactSecrets('http://plex:32400/library/sections?X-Plex-Token=ABC123')).toBe(
      `http://plex:32400/library/sections?X-Plex-Token=${REDACTED}`,
    );
    expect(redactSecrets('https://gotify/message?token=GOTIFY_TOK')).toBe(
      `https://gotify/message?token=${REDACTED}`,
    );
  });

  it('redacts Telegram-style bot tokens in a URL path', () => {
    expect(redactSecrets('https://api.telegram.org/bot123456:ABC-DEF/sendMessage')).toBe(
      `https://api.telegram.org/bot${REDACTED}/sendMessage`,
    );
  });

  it('does not redact benign /bot* path segments', () => {
    expect(redactSecrets('https://host/robot')).toBe('https://host/robot');
    expect(redactSecrets('https://host/api/bot-status')).toBe('https://host/api/bot-status');
    expect(redactSecrets('/bots/list')).toBe('/bots/list');
    expect(redactSecrets('https://cdn.example.com/img/bottom_banner.jpg')).toBe(
      'https://cdn.example.com/img/bottom_banner.jpg',
    );
  });

  it('redacts Bearer / Basic credentials in strings', () => {
    expect(redactSecrets('Authorization: Bearer abc.def.ghi')).toContain(`Bearer ${REDACTED}`);
    expect(redactSecrets('Basic dXNlcjpwYXNz')).toBe(`Basic ${REDACTED}`);
  });

  it('scrubs secrets inside Error messages and arrays', () => {
    const err = new Error('fetch failed for https://x?api_key=SECRET');
    const out = redactSecrets(err);
    expect(out).toBeInstanceOf(Error);
    expect((out as Error).message).toBe(`fetch failed for https://x?api_key=${REDACTED}`);

    const arr = redactSecrets([{ token: 't' }, 'plain', '?token=Q']);
    expect((arr[0] as { token: string }).token).toBe(REDACTED);
    expect(arr[1]).toBe('plain');
    expect(arr[2]).toBe(`?token=${REDACTED}`);
  });

  it('handles primitives and null/undefined unchanged', () => {
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets(null)).toBe(null);
    expect(redactSecrets(undefined)).toBe(undefined);
    expect(redactSecrets('no secrets here')).toBe('no secrets here');
  });

  it('handles circular references without throwing', () => {
    const a: Record<string, unknown> = { token: 'x' };
    a.self = a;
    const out = redactSecrets(a) as Record<string, unknown>;
    expect(out.token).toBe(REDACTED);
    expect(out.self).toBe('[Circular]');
  });
});

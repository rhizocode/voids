import { describe, it, expect, afterEach, vi } from 'vitest';
import { NotificationProviderId } from '@voids/shared';
import { TelegramProvider } from './telegram.provider';
import { PushBulletProvider } from './pushbullet.provider';
import { SlackProvider } from './slack.provider';
import { GotifyProvider } from './gotify.provider';
import { PushOverProvider } from './pushover.provider';
import { DiscordProvider } from './discord.provider';
import { escapeHtml, escapeSlack } from './notification-provider.interface';

/** Capture the single fetch call and assert URL/method/headers/body. */
function mockFetchOk() {
  const fn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function lastCall(fn: ReturnType<typeof vi.fn>) {
  const [url, init] = fn.mock.calls[0];
  return {
    url: url as string,
    method: (init as RequestInit).method,
    headers: (init as RequestInit).headers as Record<string, string>,
    body: JSON.parse((init as RequestInit).body as string),
  };
}

describe('notification providers — HTTP request shapes (gaps-reference §6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Telegram → POST sendMessage with HTML text', async () => {
    const fetchFn = mockFetchOk();
    const p = new TelegramProvider();
    await p.send(
      { id: NotificationProviderId.TELEGRAM, botId: 'BOT', chatId: 'CHAT' },
      'TEST',
      'info',
      'Title',
      'Body',
    );
    const c = lastCall(fetchFn);
    expect(c.url).toBe('https://api.telegram.org/botBOT/sendMessage');
    expect(c.method).toBe('POST');
    expect(c.headers['Content-Type']).toBe('application/json');
    expect(c.body).toEqual({
      chat_id: 'CHAT',
      text: '<strong>Title</strong>\nBody',
      parse_mode: 'HTML',
    });
  });

  it('PushBullet → POST /v2/pushes note with Access-Token header', async () => {
    const fetchFn = mockFetchOk();
    const p = new PushBulletProvider();
    await p.send(
      { id: NotificationProviderId.PUSHBULLET, accessToken: 'TOKEN', channelTag: 'tag' },
      'TEST',
      'info',
      'Title',
      'Body',
    );
    const c = lastCall(fetchFn);
    expect(c.url).toBe('https://api.pushbullet.com/v2/pushes');
    expect(c.method).toBe('POST');
    expect(c.headers['Access-Token']).toBe('TOKEN');
    expect(c.body).toEqual({ type: 'note', channel_tag: 'tag', title: 'Title', body: 'Body' });
  });

  it('Slack → POST webhook with blocks mrkdwn', async () => {
    const fetchFn = mockFetchOk();
    const p = new SlackProvider();
    await p.send(
      { id: NotificationProviderId.SLACK, webHookUrl: 'https://hooks.slack.com/services/X' },
      'TEST',
      'info',
      'Title',
      'Body',
    );
    const c = lastCall(fetchFn);
    expect(c.url).toBe('https://hooks.slack.com/services/X');
    expect(c.method).toBe('POST');
    expect(c.body).toEqual({
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*Title*\nBody' } }],
    });
  });

  it('Gotify → POST {address}/message?token= with title/message/priority', async () => {
    const fetchFn = mockFetchOk();
    const p = new GotifyProvider();
    await p.send(
      { id: NotificationProviderId.GOTIFY, address: 'https://gotify.example.com/', token: 'TOK', priority: 7 },
      'TEST',
      'info',
      'Title',
      'Body',
    );
    const c = lastCall(fetchFn);
    expect(c.url).toBe('https://gotify.example.com/message?token=TOK');
    expect(c.method).toBe('POST');
    expect(c.body).toEqual({ title: 'Title', message: 'Body', priority: 7 });
  });

  it('PushOver → POST /1/messages.json with token/user/title/message', async () => {
    const fetchFn = mockFetchOk();
    const p = new PushOverProvider();
    await p.send(
      {
        id: NotificationProviderId.PUSHOVER,
        token: 'APITOKEN',
        user: 'USER',
        priority: 1,
        sound: 'pushover',
        retry: 60,
        expire: 3600,
      },
      'TEST',
      'info',
      'Title',
      'Body',
    );
    const c = lastCall(fetchFn);
    expect(c.url).toBe('https://api.pushover.net/1/messages.json');
    expect(c.method).toBe('POST');
    expect(c.body).toEqual({
      token: 'APITOKEN',
      user: 'USER',
      priority: 1,
      sound: 'pushover',
      title: 'Title',
      message: 'Body',
      retry: 60,
      expire: 3600,
    });
  });

  it('Discord → POST webhook with embeds title/description', async () => {
    const fetchFn = mockFetchOk();
    const p = new DiscordProvider();
    await p.send(
      { id: NotificationProviderId.DISCORD, webHookUrl: 'https://discord.com/api/webhooks/X' },
      'TEST',
      'info',
      'Title',
      'Body',
    );
    const c = lastCall(fetchFn);
    expect(c.url).toBe('https://discord.com/api/webhooks/X');
    expect(c.method).toBe('POST');
    expect(c.body).toEqual({ embeds: [{ title: 'Title', description: 'Body' }] });
  });

  it('escapeHtml escapes & < > in the right order', () => {
    expect(escapeHtml('Fast & Furious')).toBe('Fast &amp; Furious');
    expect(escapeHtml('Movies <4K>')).toBe('Movies &lt;4K&gt;');
    expect(escapeHtml('A & <B>')).toBe('A &amp; &lt;B&gt;');
  });

  it('escapeSlack escapes & < >', () => {
    expect(escapeSlack('Fast & Furious')).toBe('Fast &amp; Furious');
    expect(escapeSlack('Movies <4K>')).toBe('Movies &lt;4K&gt;');
  });

  it('Telegram → escapes & < > in title and body', async () => {
    const fetchFn = mockFetchOk();
    const p = new TelegramProvider();
    await p.send(
      { id: NotificationProviderId.TELEGRAM, botId: 'BOT', chatId: 'CHAT' },
      'TEST',
      'info',
      'Fast & Furious',
      'Movies <4K> & more',
    );
    const c = lastCall(fetchFn);
    expect(c.body.text).toBe(
      '<strong>Fast &amp; Furious</strong>\nMovies &lt;4K&gt; &amp; more',
    );
  });

  it('Slack → escapes & < > in title and body', async () => {
    const fetchFn = mockFetchOk();
    const p = new SlackProvider();
    await p.send(
      { id: NotificationProviderId.SLACK, webHookUrl: 'https://hooks.slack.com/services/X' },
      'TEST',
      'info',
      'Fast & Furious',
      'Movies <4K> & more',
    );
    const c = lastCall(fetchFn);
    expect(c.body.blocks[0].text.text).toBe(
      '*Fast &amp; Furious*\nMovies &lt;4K&gt; &amp; more',
    );
  });

  it('throws on a non-2xx response', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fn);
    const p = new SlackProvider();
    await expect(
      p.send(
        { id: NotificationProviderId.SLACK, webHookUrl: 'https://hooks.slack.com/services/X' },
        'TEST',
        'info',
        'T',
        'B',
      ),
    ).rejects.toThrow(/HTTP 500/);
  });
});

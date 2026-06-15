import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotificationProviderId,
  type NotificationProviderConfig,
} from '@voids/shared';
import { NotificationService } from './notification.service';
import type { NotificationRepository } from '../db/repositories/notification.repository';
import type { NotificationProvider } from './providers';

function cfg(
  id: NotificationProviderId,
  overrides: Partial<NotificationProviderConfig> = {},
): NotificationProviderConfig {
  return {
    id,
    name: `p${id}`,
    enabled: true,
    config: { id } as NotificationProviderConfig['config'],
    notificationTypes: ['GAPS_MISSING_COLLECTIONS'],
    ...overrides,
  };
}

function makeProvider(id: NotificationProviderId): NotificationProvider & { send: ReturnType<typeof vi.fn> } {
  return {
    id,
    name: `p${id}`,
    configSchema: {} as never,
    isEnabled: () => true,
    send: vi.fn().mockResolvedValue(undefined),
  };
}

describe('NotificationService fan-out', () => {
  let repo: { listEnabled: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repo = { listEnabled: vi.fn(), find: vi.fn() };
  });

  it('sends only to providers subscribed to the type', async () => {
    const subscribed = cfg(NotificationProviderId.SLACK, {
      notificationTypes: ['GAPS_MISSING_COLLECTIONS'],
    });
    const notSubscribed = cfg(NotificationProviderId.DISCORD, {
      notificationTypes: ['PLEX_SERVER_CONNECTION'],
    });
    repo.listEnabled.mockReturnValue([subscribed, notSubscribed]);

    const slack = makeProvider(NotificationProviderId.SLACK);
    const discord = makeProvider(NotificationProviderId.DISCORD);
    const svc = new NotificationService(repo as unknown as NotificationRepository, [slack, discord]);

    await svc.notify('GAPS_MISSING_COLLECTIONS', 'info', 'T', 'B');

    expect(slack.send).toHaveBeenCalledOnce();
    expect(discord.send).not.toHaveBeenCalled();
  });

  it('TEST bypasses the subscription filter (sends to all enabled)', async () => {
    const a = cfg(NotificationProviderId.SLACK, { notificationTypes: [] });
    const b = cfg(NotificationProviderId.DISCORD, { notificationTypes: [] });
    repo.listEnabled.mockReturnValue([a, b]);

    const slack = makeProvider(NotificationProviderId.SLACK);
    const discord = makeProvider(NotificationProviderId.DISCORD);
    const svc = new NotificationService(repo as unknown as NotificationRepository, [slack, discord]);

    await svc.notify('TEST', 'info', 'T', 'B');

    expect(slack.send).toHaveBeenCalledOnce();
    expect(discord.send).toHaveBeenCalledOnce();
  });

  it('one provider failing does not break the others and never throws', async () => {
    repo.listEnabled.mockReturnValue([
      cfg(NotificationProviderId.SLACK),
      cfg(NotificationProviderId.DISCORD),
    ]);
    const slack = makeProvider(NotificationProviderId.SLACK);
    slack.send.mockRejectedValue(new Error('boom'));
    const discord = makeProvider(NotificationProviderId.DISCORD);
    const svc = new NotificationService(repo as unknown as NotificationRepository, [slack, discord]);

    await expect(svc.notify('GAPS_MISSING_COLLECTIONS', 'info', 'T', 'B')).resolves.toBeUndefined();
    expect(discord.send).toHaveBeenCalledOnce();
  });

  it('test() returns 70 on success', async () => {
    repo.find.mockReturnValue(cfg(NotificationProviderId.SLACK));
    const slack = makeProvider(NotificationProviderId.SLACK);
    const svc = new NotificationService(repo as unknown as NotificationRepository, [slack]);

    const result = await svc.test(NotificationProviderId.SLACK);
    expect(result.code).toBe(70);
    expect(slack.send).toHaveBeenCalledOnce();
  });

  it('test() returns 71 on provider failure', async () => {
    repo.find.mockReturnValue(cfg(NotificationProviderId.SLACK));
    const slack = makeProvider(NotificationProviderId.SLACK);
    slack.send.mockRejectedValue(new Error('bad webhook'));
    const svc = new NotificationService(repo as unknown as NotificationRepository, [slack]);

    const result = await svc.test(NotificationProviderId.SLACK);
    expect(result.code).toBe(71);
    expect(result.reason).toContain('bad webhook');
  });

  it('test() returns 71 when the provider id is unknown', async () => {
    repo.find.mockReturnValue(undefined);
    const svc = new NotificationService(repo as unknown as NotificationRepository, []);
    const result = await svc.test(NotificationProviderId.SLACK);
    expect(result.code).toBe(71);
  });

  it('testAll() tests every enabled provider and tags each with its id', async () => {
    const enabled = [cfg(NotificationProviderId.SLACK), cfg(NotificationProviderId.DISCORD)];
    repo.listEnabled.mockReturnValue(enabled);
    repo.find.mockImplementation((id: NotificationProviderId) => enabled.find((c) => c.id === id));

    const slack = makeProvider(NotificationProviderId.SLACK);
    const discord = makeProvider(NotificationProviderId.DISCORD);
    discord.send.mockRejectedValue(new Error('nope'));
    const svc = new NotificationService(repo as unknown as NotificationRepository, [slack, discord]);

    const results = await svc.testAll();
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.id === NotificationProviderId.SLACK)?.code).toBe(70);
    expect(results.find((r) => r.id === NotificationProviderId.DISCORD)?.code).toBe(71);
  });
});

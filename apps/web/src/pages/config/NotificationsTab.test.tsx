import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsTab } from './NotificationsTab';
import { renderWithProviders } from '../../test/render';
import { fakeNotifications } from '../../test/fixtures';
import * as client from '../../api/client';

vi.mock('../../api/client');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.get).mockImplementation((path: string) => {
    if (path === '/notifications') return Promise.resolve(fakeNotifications) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`)) as never;
  });
});

/** Expand a provider's panel (the panels start collapsed). */
async function openPanel(user: ReturnType<typeof userEvent.setup>, name: string) {
  // The header button contains the provider name and "Edit".
  const headers = screen.getAllByRole('button', { name: new RegExp(`${name}.*Edit`) });
  await user.click(headers[0]);
}

describe('Notifications tab', () => {
  it('renders a panel for each of the seven providers', async () => {
    renderWithProviders(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Telegram.*Edit/ })).toBeInTheDocument();
    });
    for (const name of [
      'Telegram',
      'PushBullet',
      'Slack',
      'Gotify',
      'Email',
      'PushOver',
      'Discord',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(`${name}.*Edit`) })).toBeInTheDocument();
    }
  });

  it('toggling enabled + filling a field + Save PUTs the right body', async () => {
    vi.mocked(client.put).mockResolvedValue({
      ...fakeNotifications[2],
      enabled: true,
      config: { id: 2, webHookUrl: 'https://example.test/fake' },
      notificationTypes: ['GAPS_MISSING_COLLECTIONS'],
    } as never);
    const user = userEvent.setup();
    renderWithProviders(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Slack.*Edit/ })).toBeInTheDocument();
    });

    await openPanel(user, 'Slack');
    await user.click(screen.getByLabelText('Enable Slack'));
    await user.type(screen.getByLabelText('Webhook URL'), 'https://example.test/fake');
    await user.click(screen.getByLabelText('Missing collections found'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(client.put).toHaveBeenCalledWith('/notifications/2', {
        enabled: true,
        config: { id: 2, webHookUrl: 'https://example.test/fake' },
        notificationTypes: ['GAPS_MISSING_COLLECTIONS'],
      });
    });
  });

  it('Test calls the provider test endpoint and shows the reason', async () => {
    vi.mocked(client.put).mockResolvedValue({
      code: 70,
      reason: 'Notification test succeeded.',
    } as never);
    const user = userEvent.setup();
    renderWithProviders(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Discord.*Edit/ })).toBeInTheDocument();
    });

    await openPanel(user, 'Discord');
    await user.click(screen.getByRole('button', { name: 'Test' }));

    await waitFor(() => {
      expect(client.put).toHaveBeenCalledWith('/notifications/6/test');
    });
    expect(await screen.findByText('Notification test succeeded.')).toBeInTheDocument();
  });

  it('Test all calls the endpoint and lists per-provider results', async () => {
    vi.mocked(client.put).mockResolvedValue([
      { id: 2, code: 71, reason: 'Notification test failed.' },
    ] as never);
    const user = userEvent.setup();
    renderWithProviders(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Test all' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Test all' }));

    await waitFor(() => {
      expect(client.put).toHaveBeenCalledWith('/notifications/test-all');
    });
    expect(await screen.findByText(/Notification test failed/)).toBeInTheDocument();
  });

  it('an invalid config surfaces a validation error and does not PUT', async () => {
    vi.mocked(client.put).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderWithProviders(<NotificationsTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Gotify.*Edit/ })).toBeInTheDocument();
    });

    await openPanel(user, 'Gotify');
    // Clear the numeric Priority field → valueAsNumber yields NaN → schema rejects.
    const priority = screen.getByLabelText('Priority');
    await user.clear(priority);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // A field error appears and no PUT was sent.
    const panel = screen.getByRole('button', { name: /Gotify.*Hide/ }).closest('div')!;
    await waitFor(() => {
      expect(within(panel).getAllByText(/expected|number|Invalid|required/i).length).toBeGreaterThan(0);
    });
    expect(client.put).not.toHaveBeenCalled();
  });
});

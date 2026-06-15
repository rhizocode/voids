import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NetworkTab } from './NetworkTab';
import { renderWithProviders } from '../../test/render';
import * as client from '../../api/client';

vi.mock('../../api/client');

const fakeNetwork = { connectTimeoutMs: 10000, readTimeoutMs: 30000 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.get).mockImplementation((path: string) => {
    if (path === '/network') return Promise.resolve(fakeNetwork) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`)) as never;
  });
});

describe('Network tab', () => {
  it('renders the current timeouts', async () => {
    renderWithProviders(<NetworkTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('Connect timeout (ms)')).toHaveValue(10000);
    });
    expect(screen.getByLabelText('Read timeout (ms)')).toHaveValue(30000);
  });

  it('Save PUTs the edited body', async () => {
    vi.mocked(client.put).mockResolvedValue({
      connectTimeoutMs: 5000,
      readTimeoutMs: 30000,
    } as never);
    const user = userEvent.setup();
    renderWithProviders(<NetworkTab />);

    const connect = await screen.findByLabelText('Connect timeout (ms)');
    await waitFor(() => expect(connect).toHaveValue(10000));

    await user.clear(connect);
    await user.type(connect, '5000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(client.put).toHaveBeenCalledWith('/network', {
        connectTimeoutMs: 5000,
        readTimeoutMs: 30000,
      });
    });
  });

  it('rejects a non-positive (zero) timeout and does not PUT', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NetworkTab />);

    const connect = await screen.findByLabelText('Connect timeout (ms)');
    await waitFor(() => expect(connect).toHaveValue(10000));

    await user.clear(connect);
    await user.type(connect, '0');
    expect(connect).toHaveValue(0);

    // Submitting an out-of-range value surfaces the schema error and never PUTs.
    // fireEvent.submit bypasses jsdom's native (min=100) constraint check so we
    // can assert the zodResolver wiring itself rejects the value.
    fireEvent.submit(connect.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/greater than or equal to 100/i)).toBeInTheDocument();
    });
    expect(client.put).not.toHaveBeenCalled();
  });
});

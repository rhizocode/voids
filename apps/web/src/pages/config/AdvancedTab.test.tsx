import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { AdvancedTab } from './AdvancedTab';
import { renderWithProviders } from '../../test/render';
import * as client from '../../api/client';

vi.mock('../../api/client');

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.get).mockImplementation((path: string) => {
    if (path === '/version') return Promise.resolve({ version: '0.1.0' }) as never;
    if (path === '/auth/mode') return Promise.resolve({ mode: 'basic' }) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`)) as never;
  });
});

describe('Advanced tab', () => {
  it('shows the version and auth mode', async () => {
    renderWithProviders(<AdvancedTab />);

    await waitFor(() => {
      expect(screen.getByText('0.1.0')).toBeInTheDocument();
    });
    expect(screen.getByText('Basic auth enabled')).toBeInTheDocument();
  });

  it('requires typing NUKE before the wipe is enabled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdvancedTab />);

    const button = screen.getByRole('button', { name: 'Wipe all data' });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText(/Type .* to confirm/i), 'nope');
    expect(button).toBeDisabled();
    expect(client.post).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/Type .* to confirm/i));
    await user.type(screen.getByLabelText(/Type .* to confirm/i), 'NUKE');
    expect(button).toBeEnabled();
  });

  it('confirmed nuke calls POST, clears queries, and navigates home', async () => {
    const clearSpy = vi.spyOn(QueryClient.prototype, 'clear');
    vi.mocked(client.post).mockResolvedValue({
      code: 30,
      reason: 'Nuke successful. All files deleted.',
    } as never);
    const user = userEvent.setup();
    renderWithProviders(<AdvancedTab />);

    await user.type(screen.getByLabelText(/Type .* to confirm/i), 'NUKE');
    await user.click(screen.getByRole('button', { name: 'Wipe all data' }));

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/nuke');
    });
    expect(clearSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/');
    });

    clearSpy.mockRestore();
  });
});

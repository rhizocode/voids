import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Payload } from '@voids/shared';
import { TmdbTab } from './TmdbTab';
import { renderWithProviders } from '../../test/render';
import { fakeSettings } from '../../test/fixtures';
import * as client from '../../api/client';

vi.mock('../../api/client');

beforeEach(() => {
  vi.mocked(client.get).mockResolvedValue(fakeSettings as never);
});

describe('TMDB tab', () => {
  it('renders the API key form', async () => {
    renderWithProviders(<TmdbTab />);
    expect(screen.getByLabelText('API key')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('calls the test endpoint and shows the reason', async () => {
    vi.mocked(client.put).mockResolvedValue({
      code: Payload.TMDB_KEY_VALID.code,
      reason: Payload.TMDB_KEY_VALID.reason,
    } as never);

    const user = userEvent.setup();
    renderWithProviders(<TmdbTab />);

    await user.type(screen.getByLabelText('API key'), 'fake-test-key');
    await user.click(screen.getByRole('button', { name: 'Test' }));

    await waitFor(() => {
      expect(screen.getByText('TMDB Key valid.')).toBeInTheDocument();
    });
    expect(client.put).toHaveBeenCalledWith('/tmdb/test', { apiKey: 'fake-test-key' });
  });
});

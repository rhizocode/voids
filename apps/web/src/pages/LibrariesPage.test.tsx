import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Payload } from '@voids/shared';
import { LibrariesPage } from './LibrariesPage';
import { renderWithProviders } from '../test/render';
import { fakeServers, fakeOwnedMovies } from '../test/fixtures';
import * as client from '../api/client';

vi.mock('../api/client');

beforeEach(() => {
  vi.mocked(client.get).mockImplementation((path: string) => {
    if (path === '/servers') return Promise.resolve(fakeServers as never);
    if (path.startsWith('/owned/')) return Promise.resolve(fakeOwnedMovies as never);
    return Promise.resolve(undefined as never);
  });
});

async function selectMovieLibrary(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => screen.getByLabelText('Media server'));
  await user.selectOptions(screen.getByLabelText('Media server'), 'server-1');
}

describe('Libraries page', () => {
  it('renders owned movies from mocked data after selecting a library', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LibrariesPage />);

    await selectMovieLibrary(user);

    await waitFor(() => {
      expect(screen.getByText('The Fast and the Furious')).toBeInTheDocument();
    });
    expect(screen.getByText('2 Fast 2 Furious')).toBeInTheDocument();
    // Owned movie with null poster renders a placeholder.
    expect(
      screen.getByRole('img', { name: 'The Fast and the Furious placeholder' }),
    ).toBeInTheDocument();
  });

  it('scan button calls the scan endpoint and toasts the count', async () => {
    vi.mocked(client.post).mockResolvedValue({
      code: Payload.PLEX_LIBRARY_MOVIE_FOUND.code,
      reason: Payload.PLEX_LIBRARY_MOVIE_FOUND.reason,
      count: 1329,
    } as never);

    const user = userEvent.setup();
    renderWithProviders(<LibrariesPage />);
    await selectMovieLibrary(user);

    await user.click(screen.getByRole('button', { name: /scan library/i }));

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/libraries/server-1/lib-movies/scan');
    });
    await waitFor(() => {
      expect(screen.getByText('Last scan: 1329 movies')).toBeInTheDocument();
    });
  });

  it('toggles to the table view', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LibrariesPage />);
    await selectMovieLibrary(user);

    await waitFor(() => screen.getByText('The Fast and the Furious'));
    await user.click(screen.getByRole('button', { name: 'Table' }));

    expect(screen.getByRole('columnheader', { name: 'TMDB' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Collection' })).toBeInTheDocument();
  });
});

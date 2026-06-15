import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MislabeledPage } from './MislabeledPage';
import { renderWithProviders } from '../test/render';
import { fakeServers, fakeMislabeled } from '../test/fixtures';
import * as client from '../api/client';

vi.mock('../api/client');

beforeEach(() => {
  vi.clearAllMocks();
});

async function selectLibrary(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => screen.getByLabelText('Media server'));
  await user.selectOptions(screen.getByLabelText('Media server'), 'server-1');
}

describe('Mislabeled page', () => {
  it('does not scan until the Scan button is clicked, then renders the table', async () => {
    vi.mocked(client.get).mockImplementation((path: string) => {
      if (path === '/servers') return Promise.resolve(fakeServers as never);
      if (path.startsWith('/mislabeled/')) return Promise.resolve(fakeMislabeled as never);
      return Promise.resolve(undefined as never);
    });

    const user = userEvent.setup();
    renderWithProviders(<MislabeledPage />);
    await selectLibrary(user);

    // No scan yet → no mislabeled GET fired.
    expect(client.get).not.toHaveBeenCalledWith(expect.stringContaining('/mislabeled/'));

    await user.click(screen.getByRole('button', { name: 'Scan' }));

    await waitFor(() => {
      expect(client.get).toHaveBeenCalledWith('/mislabeled/server-1/lib-movies/3');
    });

    expect(await screen.findByText('The Matrx')).toBeInTheDocument();
    expect(screen.getByText('Blade Runner 2049')).toBeInTheDocument();
    // TMDB link points at the right movie.
    expect(screen.getByRole('link', { name: 'The Matrix' })).toHaveAttribute(
      'href',
      'https://www.themoviedb.org/movie/603',
    );
  });

  it('scans at the chosen threshold', async () => {
    vi.mocked(client.get).mockImplementation((path: string) => {
      if (path === '/servers') return Promise.resolve(fakeServers as never);
      if (path.startsWith('/mislabeled/')) return Promise.resolve(fakeMislabeled as never);
      return Promise.resolve(undefined as never);
    });

    const user = userEvent.setup();
    renderWithProviders(<MislabeledPage />);
    await selectLibrary(user);

    const input = screen.getByLabelText('Distance threshold');
    await user.clear(input);
    await user.type(input, '5');
    await user.click(screen.getByRole('button', { name: 'Scan' }));

    await waitFor(() => {
      expect(client.get).toHaveBeenCalledWith('/mislabeled/server-1/lib-movies/5');
    });
  });

  it('shows the empty state when no entries are flagged', async () => {
    vi.mocked(client.get).mockImplementation((path: string) => {
      if (path === '/servers') return Promise.resolve(fakeServers as never);
      if (path.startsWith('/mislabeled/')) return Promise.resolve([] as never);
      return Promise.resolve(undefined as never);
    });

    const user = userEvent.setup();
    renderWithProviders(<MislabeledPage />);
    await selectLibrary(user);

    await user.click(screen.getByRole('button', { name: 'Scan' }));

    expect(
      await screen.findByText('No likely-mislabeled entries found.'),
    ).toBeInTheDocument();
  });
});

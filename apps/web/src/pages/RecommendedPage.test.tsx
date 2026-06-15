import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecommendedPage } from './RecommendedPage';
import { renderWithProviders } from '../test/render';
import { fakeServers, fakeRecommended } from '../test/fixtures';
import * as client from '../api/client';
import * as jobHook from '../hooks/useJobProgress';
import type { UseJobProgress } from '../hooks/useJobProgress';

vi.mock('../api/client');
vi.mock('../hooks/useJobProgress');

const idleProgress: UseJobProgress = {
  jobId: null,
  status: 'idle',
  searchedCount: 0,
  totalCount: 0,
  foundCount: 0,
  lastFoundMovie: null,
  reason: null,
  finished: false,
  cancel: vi.fn(),
};

beforeEach(() => {
  vi.mocked(client.get).mockImplementation((path: string) => {
    if (path === '/servers') return Promise.resolve(fakeServers as never);
    if (path.startsWith('/recommended/')) return Promise.resolve(fakeRecommended as never);
    return Promise.resolve(undefined as never);
  });
  vi.mocked(jobHook.useJobProgress).mockReturnValue(idleProgress);
});

async function selectLibrary(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => screen.getByLabelText('Media server'));
  await user.selectOptions(screen.getByLabelText('Media server'), 'server-1');
}

describe('Recommended page', () => {
  it('renders recommendations grouped by collection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecommendedPage />);
    await selectLibrary(user);

    await waitFor(() => {
      expect(screen.getByText(/The Fast and the Furious Collection/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Toy Story Collection/)).toBeInTheDocument();
    expect(screen.getByText('Fast Five')).toBeInTheDocument();
    expect(screen.getByText('Furious 7')).toBeInTheDocument();
    // status badge from fixture
    expect(screen.getAllByText('new').length).toBeGreaterThanOrEqual(2);
  });

  it('clicking Run calls the start-search endpoint', async () => {
    vi.mocked(client.post).mockResolvedValue({ jobId: 42 } as never);

    const user = userEvent.setup();
    renderWithProviders(<RecommendedPage />);
    await selectLibrary(user);

    await user.click(screen.getByRole('button', { name: 'Run search' }));

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/search/server-1/lib-movies');
    });
  });

  it('progress bar reflects a simulated useJobProgress state', async () => {
    vi.mocked(client.post).mockResolvedValue({ jobId: 42 } as never);
    vi.mocked(jobHook.useJobProgress).mockReturnValue({
      ...idleProgress,
      jobId: 42,
      status: 'running',
      searchedCount: 25,
      totalCount: 100,
      foundCount: 3,
      lastFoundMovie: {
        title: 'Fast Five',
        year: 2011,
        tmdbId: 51497,
        imdbId: null,
        collectionId: 9485,
        collectionTitle: 'The Fast and the Furious Collection',
        posterUrl: null,
        backdropUrl: null,
        language: 'en',
        overview: null,
        genres: [],
        moviesInCollection: [],
        mediaItemId: null,
        mediaItemKey: null,
      },
    });

    const user = userEvent.setup();
    renderWithProviders(<RecommendedPage />);
    await selectLibrary(user);

    // Start a search so the page sets its jobId and renders the progress block.
    await user.click(screen.getByRole('button', { name: 'Run search' }));
    await waitFor(() => screen.getByRole('progressbar'));

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('25 / 100 searched · 25%')).toBeInTheDocument();
    expect(screen.getByText('3 gaps found')).toBeInTheDocument();
    expect(screen.getByText(/Latest gap:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});

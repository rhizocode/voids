import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecommendedPage } from './RecommendedPage';
import { renderWithProviders } from '../test/render';
import { fakeServers, fakeRecommended, fakeRadarrPushResults } from '../test/fixtures';
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

  it('status filter hides and reveals items by status', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecommendedPage />);
    await selectLibrary(user);

    // Default filter is New + Approved: Toy Story 4 (approved) is visible.
    await waitFor(() => expect(screen.getByText('Fast Five')).toBeInTheDocument());
    expect(screen.getByText('Toy Story 4')).toBeInTheDocument();

    // Filter to New only -> approved Toy Story 4 disappears.
    await user.selectOptions(screen.getByLabelText('Status filter'), 'new');
    await waitFor(() => expect(screen.queryByText('Toy Story 4')).not.toBeInTheDocument());
    expect(screen.getByText('Fast Five')).toBeInTheDocument();

    // Filter to Approved only -> only Toy Story 4 remains.
    await user.selectOptions(screen.getByLabelText('Status filter'), 'approved');
    await waitFor(() => expect(screen.getByText('Toy Story 4')).toBeInTheDocument());
    expect(screen.queryByText('Fast Five')).not.toBeInTheDocument();
  });

  it('clicking Approve calls the PATCH endpoint with approved status', async () => {
    vi.mocked(client.patch).mockResolvedValue({ ...fakeRecommended[0], status: 'approved' } as never);

    const user = userEvent.setup();
    renderWithProviders(<RecommendedPage />);
    await selectLibrary(user);

    await waitFor(() => screen.getByText('Fast Five'));
    await user.click(screen.getByRole('button', { name: 'Approve Fast Five' }));

    await waitFor(() => {
      expect(client.patch).toHaveBeenCalledWith('/recommended/1', { status: 'approved' });
    });
  });

  it('Copy TMDB IDs writes the filtered ids to the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderWithProviders(<RecommendedPage />);
    await selectLibrary(user);

    await waitFor(() => screen.getByText('Fast Five'));
    await user.click(screen.getByRole('button', { name: 'Copy TMDB IDs' }));

    await waitFor(() => {
      // Default filter (New + Approved) => Fast Five 51497, Furious 7 168259, Toy Story 4 301528.
      expect(writeText).toHaveBeenCalledWith('51497,168259,301528');
    });
  });

  it('Export JSON triggers a client-side download', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const user = userEvent.setup();
    renderWithProviders(<RecommendedPage />);
    await selectLibrary(user);

    await waitFor(() => screen.getByText('Fast Five'));
    await user.click(screen.getByRole('button', { name: 'Export JSON' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    clickSpy.mockRestore();
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

  it('Push approved to Radarr calls push-radarr and shows the summary', async () => {
    vi.mocked(client.post).mockImplementation((path: string) => {
      if (path.endsWith('/push-radarr')) {
        return Promise.resolve({ configured: true, results: fakeRadarrPushResults }) as never;
      }
      return Promise.resolve(undefined as never);
    });

    const user = userEvent.setup();
    renderWithProviders(<RecommendedPage />);
    await selectLibrary(user);

    await waitFor(() => screen.getByText('Fast Five'));
    await user.click(screen.getByRole('button', { name: 'Push approved to Radarr' }));

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/recommended/server-1/lib-movies/push-radarr');
    });

    // Toast summary: 2 added, 1 exists, 0 failed.
    expect(await screen.findByText('Added 2, already in Radarr 1, failed 0.')).toBeInTheDocument();
    // Inline result list.
    const results = screen.getByLabelText('push to radarr results');
    expect(results).toHaveTextContent('Fast Five');
    expect(results).toHaveTextContent('Already in Radarr');
  });

  it('Push approved to Radarr toasts a config prompt when Radarr is unconfigured', async () => {
    vi.mocked(client.post).mockImplementation((path: string) => {
      if (path.endsWith('/push-radarr')) {
        return Promise.resolve({ configured: false, results: [] }) as never;
      }
      return Promise.resolve(undefined as never);
    });

    const user = userEvent.setup();
    renderWithProviders(<RecommendedPage />);
    await selectLibrary(user);

    await waitFor(() => screen.getByText('Fast Five'));
    await user.click(screen.getByRole('button', { name: 'Push approved to Radarr' }));

    expect(await screen.findByText('Configure Radarr first.')).toBeInTheDocument();
    expect(screen.queryByLabelText('push to radarr results')).not.toBeInTheDocument();
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

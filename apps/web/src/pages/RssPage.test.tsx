import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RssPage } from './RssPage';
import { renderWithProviders } from '../test/render';
import { fakeRssFeeds } from '../test/fixtures';
import * as client from '../api/client';

vi.mock('../api/client');

describe('RSS page', () => {
  beforeEach(() => {
    vi.mocked(client.get).mockImplementation((path: string) => {
      if (path === '/rss') return Promise.resolve(fakeRssFeeds as never);
      return Promise.resolve(undefined as never);
    });
  });

  it('renders each feed with its absolute URL and item count', async () => {
    renderWithProviders(<RssPage />);

    await waitFor(() => expect(screen.getByText('Movies')).toBeInTheDocument());
    expect(screen.getByText('4K Movies')).toBeInTheDocument();
    expect(screen.getByText('3 items in feed')).toBeInTheDocument();
    expect(screen.getByText('1 item in feed')).toBeInTheDocument();

    // Absolute URL = origin + server-provided path.
    const origin = window.location.origin;
    expect(screen.getByText(`${origin}/rss/server-1/lib-movies`)).toBeInTheDocument();
    expect(screen.getByText(`${origin}/rss/server-1/lib-4k`)).toBeInTheDocument();
  });

  it('Copy URL writes the absolute feed URL to the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderWithProviders(<RssPage />);

    await waitFor(() => screen.getByText('Movies'));
    const copyButtons = screen.getAllByRole('button', { name: 'Copy URL' });
    await user.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/rss/server-1/lib-movies`);
    });
  });

  it('shows an empty state when there are no feeds', async () => {
    vi.mocked(client.get).mockResolvedValue([] as never);
    renderWithProviders(<RssPage />);

    await waitFor(() => expect(screen.getByText('No feeds yet.')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Recommended' })).toBeInTheDocument();
  });
});

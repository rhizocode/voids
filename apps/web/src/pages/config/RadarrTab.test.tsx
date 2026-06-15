import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadarrTab } from './RadarrTab';
import { renderWithProviders } from '../../test/render';
import {
  fakeSettingsWithRadarr,
  fakeRadarrQualityProfiles,
  fakeRadarrRootFolders,
} from '../../test/fixtures';
import * as client from '../../api/client';

vi.mock('../../api/client');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.get).mockImplementation((path: string) => {
    if (path === '/settings') return Promise.resolve(fakeSettingsWithRadarr) as never;
    if (path === '/radarr/quality-profiles')
      return Promise.resolve(fakeRadarrQualityProfiles) as never;
    if (path === '/radarr/root-folders') return Promise.resolve(fakeRadarrRootFolders) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`)) as never;
  });
});

describe('Radarr tab', () => {
  it('renders saved settings and populates profile/folder selects', async () => {
    renderWithProviders(<RadarrTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('URL')).toHaveValue('http://radarr.example.test:7878');
    });

    // Selects (not manual inputs) are rendered because the lists loaded.
    const profile = await screen.findByLabelText('Quality profile');
    expect(profile.tagName).toBe('SELECT');
    expect(profile).toHaveValue('2');
    expect(screen.getByRole('option', { name: 'HD-1080p' })).toBeInTheDocument();

    const folder = screen.getByLabelText('Root folder');
    expect(folder.tagName).toBe('SELECT');
    expect(folder).toHaveValue('/movies');

    expect(screen.getByLabelText('Minimum availability')).toHaveValue('released');
    expect(
      screen.getByLabelText('Automatically push approved gaps to Radarr on scheduled runs'),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('Save PUTs the radarr config and autoPushRadarr', async () => {
    vi.mocked(client.put).mockResolvedValue(fakeSettingsWithRadarr as never);
    const user = userEvent.setup();
    renderWithProviders(<RadarrTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('URL')).toHaveValue('http://radarr.example.test:7878');
    });

    await user.selectOptions(screen.getByLabelText('Quality profile'), '3');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(client.put).toHaveBeenCalledWith('/settings', {
        radarr: {
          url: 'http://radarr.example.test:7878',
          apiKey: 'fake-radarr-key',
          qualityProfileId: 3,
          rootFolderPath: '/movies',
          monitored: true,
          minimumAvailability: 'released',
          searchOnAdd: true,
        },
        autoPushRadarr: true,
      });
    });
  });

  it('Test connection calls PUT /radarr/test and toasts the reason', async () => {
    vi.mocked(client.put).mockResolvedValue({
      code: 160,
      reason: 'Connection to Radarr succeeded.',
    } as never);
    const user = userEvent.setup();
    renderWithProviders(<RadarrTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('URL')).toHaveValue('http://radarr.example.test:7878');
    });

    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    await waitFor(() => {
      expect(client.put).toHaveBeenCalledWith('/radarr/test');
    });
    expect(await screen.findByText('Connection to Radarr succeeded.')).toBeInTheDocument();
  });

  it('falls back to manual inputs when profile/folder lists are empty', async () => {
    vi.mocked(client.get).mockImplementation((path: string) => {
      if (path === '/settings') return Promise.resolve(fakeSettingsWithRadarr) as never;
      if (path === '/radarr/quality-profiles') return Promise.resolve([]) as never;
      if (path === '/radarr/root-folders') return Promise.resolve([]) as never;
      return Promise.reject(new Error(`unexpected GET ${path}`)) as never;
    });

    renderWithProviders(<RadarrTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('URL')).toHaveValue('http://radarr.example.test:7878');
    });

    expect(screen.getByLabelText('Quality profile').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Root folder').tagName).toBe('INPUT');
  });

  it('Save shows error toast when url or apiKey is blank', async () => {
    const { fakeSettings } = await import('../../test/fixtures');
    vi.mocked(client.get).mockImplementation((path: string) => {
      if (path === '/settings') return Promise.resolve({ ...fakeSettings, radarr: null }) as never;
      if (path === '/radarr/quality-profiles') return Promise.resolve([]) as never;
      if (path === '/radarr/root-folders') return Promise.resolve([]) as never;
      return Promise.reject(new Error(`unexpected GET ${path}`)) as never;
    });

    const user = userEvent.setup();
    renderWithProviders(<RadarrTab />);

    // Wait for settings to load (url field will be empty string from EMPTY_DRAFT).
    await waitFor(() => {
      expect(screen.getByLabelText('URL')).toHaveValue('');
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Fix the Radarr config before saving.')).toBeInTheDocument();
    expect(client.put).not.toHaveBeenCalled();
  });
});

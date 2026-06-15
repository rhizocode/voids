import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleTab } from './ScheduleTab';
import { renderWithProviders } from '../../test/render';
import { fakeSchedule, fakeSchedulePresets, fakeMovieStatus } from '../../test/fixtures';
import * as client from '../../api/client';

vi.mock('../../api/client');

beforeEach(() => {
  vi.clearAllMocks();
  // Route GETs by path so the tab can load schedule, presets, and movie-status.
  vi.mocked(client.get).mockImplementation((path: string) => {
    if (path === '/schedule') return Promise.resolve(fakeSchedule) as never;
    if (path === '/schedule/all') return Promise.resolve(fakeSchedulePresets) as never;
    if (path === '/movie-status') return Promise.resolve(fakeMovieStatus) as never;
    return Promise.reject(new Error(`unexpected GET ${path}`)) as never;
  });
});

describe('Schedule tab', () => {
  it('renders the current schedule config', async () => {
    renderWithProviders(<ScheduleTab />);

    // Effective cron reflects the seeded daily preset (id 1).
    await waitFor(() => {
      expect(screen.getByLabelText('Effective cron')).toHaveValue('0 0 4 * * ?');
    });
    expect(screen.getByLabelText('Enable automated searches')).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('updates the effective cron when a different preset is chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduleTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('Effective cron')).toHaveValue('0 0 4 * * ?');
    });

    // Switch to Weekly (id 2 → '0 0 4 * * MON').
    await user.selectOptions(screen.getByLabelText('Preset'), '2');
    expect(screen.getByLabelText('Effective cron')).toHaveValue('0 0 4 * * MON');
  });

  it('Save calls the PUT with the effective config', async () => {
    vi.mocked(client.put).mockResolvedValue(fakeSchedule as never);
    const user = userEvent.setup();
    renderWithProviders(<ScheduleTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('Effective cron')).toHaveValue('0 0 4 * * ?');
    });

    await user.selectOptions(screen.getByLabelText('Preset'), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(client.put).toHaveBeenCalledWith('/schedule', {
        enabled: true,
        mode: 'preset',
        presetId: 2,
        cron: '0 0 4 * * MON',
      });
    });
  });

  it('Run search now calls the POST endpoint', async () => {
    vi.mocked(client.post).mockResolvedValue({ started: true } as never);
    const user = userEvent.setup();
    renderWithProviders(<ScheduleTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('Effective cron')).toHaveValue('0 0 4 * * ?');
    });

    await user.click(screen.getByRole('button', { name: 'Run search now' }));

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/schedule/run');
    });
  });

  it('custom cron mode validates and feeds the effective cron', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ScheduleTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('Effective cron')).toHaveValue('0 0 4 * * ?');
    });

    await user.click(screen.getByRole('button', { name: 'Custom cron' }));
    const input = screen.getByLabelText('Custom cron (Quartz, 6 fields)');
    await user.type(input, '0 30 2 * * ?');

    expect(screen.getByLabelText('Effective cron')).toHaveValue('0 30 2 * * ?');
  });

  it('MovieStatus toggle calls the PUT', async () => {
    vi.mocked(client.put).mockResolvedValue({ id: 1, label: 'Released' } as never);
    const user = userEvent.setup();
    renderWithProviders(<ScheduleTab />);

    await waitFor(() => {
      expect(screen.getByLabelText('Effective cron')).toHaveValue('0 0 4 * * ?');
    });

    // Fixture starts at ALL(0) → off; toggling on sets RELEASED(1).
    await user.click(screen.getByLabelText('Recommend only released movies'));

    await waitFor(() => {
      expect(client.put).toHaveBeenCalledWith('/movie-status', { movieStatus: 1 });
    });
  });
});

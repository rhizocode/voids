import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { ServersTab } from './ServersTab';
import { renderWithProviders } from '../../test/render';
import { fakeServers } from '../../test/fixtures';
import * as client from '../../api/client';

vi.mock('../../api/client');

beforeEach(() => {
  vi.mocked(client.get).mockImplementation(async (path: string) => {
    if (path === '/servers') return fakeServers as never;
    throw new Error(`unexpected GET ${path}`);
  });
});

describe('Media Servers tab', () => {
  it('renders the server list from mocked data with a type badge and address', async () => {
    renderWithProviders(<ServersTab />);

    expect(await screen.findByText('Test Media Server')).toBeInTheDocument();
    expect(screen.getByText('jellyfin')).toBeInTheDocument();
    expect(screen.getByText('http://media.example.test:8096')).toBeInTheDocument();
  });

  it('lists libraries with enabled and default toggles', async () => {
    renderWithProviders(<ServersTab />);

    expect(await screen.findByText('Movies')).toBeInTheDocument();
    expect(screen.getByText('TV Shows')).toBeInTheDocument();

    // Each library has an Enable and a Default switch (role=switch).
    expect(screen.getByRole('switch', { name: 'Enable Movies' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Set Movies as default' })).toBeInTheDocument();
  });

  it('shows the add media server form', async () => {
    renderWithProviders(<ServersTab />);
    expect(await screen.findByRole('button', { name: 'Add media server' })).toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Port')).toBeInTheDocument();
  });
});

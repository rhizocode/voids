import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { App } from './App';
import { renderWithProviders } from './test/render';
import { fakeSettings } from './test/fixtures';
import * as client from './api/client';

vi.mock('./api/client');

beforeEach(() => {
  vi.mocked(client.get).mockImplementation(async (path: string) => {
    if (path === '/settings') return fakeSettings as never;
    if (path === '/servers') return [] as never;
    if (path === '/version') return { version: '0.1.0' } as never;
    throw new Error(`unexpected GET ${path}`);
  });
});

describe('App shell', () => {
  it('renders all nav links', () => {
    renderWithProviders(<App />);
    for (const label of ['Status', 'Configuration', 'Libraries', 'Recommended', 'RSS', 'About']) {
      // Each label appears in both the desktop and mobile nav.
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0);
    }
  });

  it('shows the app name and tagline', () => {
    renderWithProviders(<App />);
    expect(screen.getAllByText('Voids').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Find the gaps in your movie collections'),
    ).toBeInTheDocument();
  });
});

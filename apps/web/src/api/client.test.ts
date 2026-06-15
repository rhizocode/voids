import { describe, it, expect } from 'vitest';

/** Mirrors the BASE computation in client.ts — kept in sync manually. */
function computeBase(baseUrl: string): string {
  return `${(baseUrl ?? '/').replace(/\/$/, '')}/api`;
}

describe('computeBase (mirrors client.ts BASE formula)', () => {
  it('yields /api at root (BASE_URL="/")', () => {
    expect(computeBase('/')).toBe('/api');
  });

  it('yields /voids/api under sub-path (BASE_URL="/voids/")', () => {
    expect(computeBase('/voids/')).toBe('/voids/api');
  });
});

import { describe, it, expect } from 'vitest';
import { Payload, payloadByCode } from './payload';
import { MovieStatus } from './movie-status';
import { Schedule } from './schedule';

describe('Payload', () => {
  it('maps SEARCH_SUCCESSFUL to code 0', () => {
    expect(Payload.SEARCH_SUCCESSFUL.code).toBe(0);
    expect(Payload.SEARCH_SUCCESSFUL.reason).toBe('Search successful.');
  });

  it('maps TMDB_KEY_VALID to code 20', () => {
    expect(Payload.TMDB_KEY_VALID.code).toBe(20);
  });

  it('resolves a payload by code', () => {
    expect(payloadByCode(50)).toEqual(Payload.RECOMMENDED_MOVIES_FOUND);
  });
});

describe('MovieStatus', () => {
  it('has ALL=0 and RELEASED=1', () => {
    expect(MovieStatus.ALL.id).toBe(0);
    expect(MovieStatus.RELEASED.id).toBe(1);
  });
});

describe('Schedule', () => {
  it('stores Quartz cron strings as data', () => {
    expect(Schedule.DAILY_4AM.cron).toBe('0 0 4 * * ?');
    expect(Schedule.HOURLY.enabled).toBe(true);
  });
});

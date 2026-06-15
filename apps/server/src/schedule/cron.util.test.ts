import { describe, it, expect } from 'vitest';
import { Schedule } from '@voids/shared';
import { quartzToCron } from './cron.util';

describe('quartzToCron', () => {
  it('normalizes the HOURLY preset (strips trailing ?)', () => {
    expect(quartzToCron(Schedule.HOURLY.cron)).toBe('0 49 * * * *');
  });

  it('normalizes the DAILY_4AM preset', () => {
    expect(quartzToCron(Schedule.DAILY_4AM.cron)).toBe('0 0 4 * * *');
  });

  it('leaves day-name tokens (MON) intact for EVERY_MONDAY', () => {
    expect(quartzToCron(Schedule.EVERY_MONDAY.cron)).toBe('0 0 4 * * MON');
  });

  it('normalizes the EVERY_TWO_WEEKS preset (day-of-week ? -> *)', () => {
    expect(quartzToCron(Schedule.EVERY_TWO_WEEKS.cron)).toBe('0 0 4 1,15 * *');
  });

  it('normalizes the EVERY_MONTH preset', () => {
    expect(quartzToCron(Schedule.EVERY_MONTH.cron)).toBe('0 0 4 1 * *');
  });

  it('passes through an already-valid custom 6-field string', () => {
    expect(quartzToCron('30 15 9 * * 1-5')).toBe('30 15 9 * * 1-5');
  });

  it('replaces a custom string with both ? markers', () => {
    expect(quartzToCron('0 0 2 ? * ?')).toBe('0 0 2 * * *');
  });

  it('throws on the empty string', () => {
    expect(() => quartzToCron('')).toThrow();
    expect(() => quartzToCron('   ')).toThrow();
  });

  it('throws when not exactly 6 fields', () => {
    expect(() => quartzToCron('0 0 4 * *')).toThrow(/6-field/);
    expect(() => quartzToCron('0 0 4 * * ? extra')).toThrow(/6-field/);
  });

  it('throws when ? appears outside the dom/dow fields', () => {
    expect(() => quartzToCron('? 0 4 * * ?')).toThrow(/day-of-month or day-of-week/);
  });

  it('throws on a clearly invalid expression', () => {
    expect(() => quartzToCron('0 99 99 * * *')).toThrow(/Invalid cron/);
    expect(() => quartzToCron('a b c d e f')).toThrow(/Invalid cron/);
  });

  it('every preset normalizes without throwing', () => {
    for (const preset of Object.values(Schedule)) {
      expect(() => quartzToCron(preset.cron)).not.toThrow();
    }
  });
});

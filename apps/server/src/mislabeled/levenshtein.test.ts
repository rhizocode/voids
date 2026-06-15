import { describe, expect, it } from 'vitest';
import { levenshtein } from './levenshtein';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('', '')).toBe(0);
    expect(levenshtein('Matrix', 'Matrix')).toBe(0);
  });

  it('equals the other string length when one is empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abcd', '')).toBe(4);
  });

  it('counts single-edit distances', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3); // classic example
    expect(levenshtein('flaw', 'lawn')).toBe(2);
    expect(levenshtein('book', 'back')).toBe(2);
  });

  it('is symmetric', () => {
    expect(levenshtein('saturday', 'sunday')).toBe(levenshtein('sunday', 'saturday'));
    expect(levenshtein('sunday', 'saturday')).toBe(3);
  });

  it('is case sensitive (caller normalizes if desired)', () => {
    expect(levenshtein('matrix', 'Matrix')).toBe(1);
  });

  it('handles realistic title typos', () => {
    expect(levenshtein('The Matrix', 'The Matrixx')).toBe(1);
    expect(levenshtein('Avengers', 'The Avengers')).toBe(4);
  });
});

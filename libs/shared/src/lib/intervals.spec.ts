import { describe, expect, it } from 'vitest';

import { intervalsOverlap } from './intervals';

const at = (iso: string): Date => new Date(iso);

describe('intervalsOverlap', () => {
  it('detects a partial overlap in both directions', () => {
    const a = { start: at('2030-01-15T10:00:00Z'), end: at('2030-01-15T11:00:00Z') };
    const b = { start: at('2030-01-15T10:30:00Z'), end: at('2030-01-15T11:30:00Z') };
    expect(intervalsOverlap(a, b)).toBe(true);
    expect(intervalsOverlap(b, a)).toBe(true);
  });

  it('treats back-to-back (touching) intervals as NOT overlapping', () => {
    const a = { start: at('2030-01-15T10:00:00Z'), end: at('2030-01-15T11:00:00Z') };
    const b = { start: at('2030-01-15T11:00:00Z'), end: at('2030-01-15T12:00:00Z') };
    expect(intervalsOverlap(a, b)).toBe(false);
    expect(intervalsOverlap(b, a)).toBe(false);
  });

  it('detects containment (one interval fully inside the other)', () => {
    const outer = { start: at('2030-01-15T09:00:00Z'), end: at('2030-01-15T13:00:00Z') };
    const inner = { start: at('2030-01-15T10:00:00Z'), end: at('2030-01-15T11:00:00Z') };
    expect(intervalsOverlap(outer, inner)).toBe(true);
    expect(intervalsOverlap(inner, outer)).toBe(true);
  });

  it('detects identical intervals as overlapping', () => {
    const a = { start: at('2030-01-15T10:00:00Z'), end: at('2030-01-15T11:00:00Z') };
    expect(intervalsOverlap(a, { ...a })).toBe(true);
  });

  it('treats fully disjoint intervals as NOT overlapping', () => {
    const a = { start: at('2030-01-15T10:00:00Z'), end: at('2030-01-15T11:00:00Z') };
    const b = { start: at('2030-01-15T14:00:00Z'), end: at('2030-01-15T15:00:00Z') };
    expect(intervalsOverlap(a, b)).toBe(false);
  });

  it('treats the same wall-clock slot on adjacent days as NOT overlapping', () => {
    const monday = { start: at('2030-01-14T10:00:00Z'), end: at('2030-01-14T11:00:00Z') };
    const tuesday = { start: at('2030-01-15T10:00:00Z'), end: at('2030-01-15T11:00:00Z') };
    expect(intervalsOverlap(monday, tuesday)).toBe(false);
    expect(intervalsOverlap(tuesday, monday)).toBe(false);
  });

  it('accepts epoch-millisecond numbers as well as Dates', () => {
    expect(intervalsOverlap({ start: 0, end: 100 }, { start: 50, end: 150 })).toBe(true);
    expect(intervalsOverlap({ start: 0, end: 100 }, { start: 100, end: 200 })).toBe(false);
  });
});

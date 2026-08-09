import { describe, expect, it } from 'vitest';

import { SLOT_MINUTES, SLOTS_PER_DAY, WORK_DAY_END_HOUR, WORK_DAY_START_HOUR } from './constants';

describe('shared constants', () => {
  it('derives a consistent slot grid for the 09:00-19:00 working day', () => {
    expect(WORK_DAY_START_HOUR).toBe(9);
    expect(WORK_DAY_END_HOUR).toBe(19);
    expect(SLOTS_PER_DAY).toBe(((WORK_DAY_END_HOUR - WORK_DAY_START_HOUR) * 60) / SLOT_MINUTES);
    expect(SLOTS_PER_DAY).toBe(20);
  });
});

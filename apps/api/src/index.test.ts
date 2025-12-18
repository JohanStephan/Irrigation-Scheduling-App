import { describe, expect, test } from 'vitest';

function isoDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNextThreeDatesFrom(base: Date): string[] {
  return [1, 2, 3].map((offset) => {
    const d = new Date(base);
    d.setDate(base.getDate() + offset);
    return isoDate(d);
  });
}

describe('horizon date generation', () => {
  test('returns tomorrow, +2, +3 in YYYY-MM-DD', () => {
    const base = new Date('2025-12-18T12:00:00');
    const dates = getNextThreeDatesFrom(base);
    expect(dates).toEqual(['2025-12-19', '2025-12-20', '2025-12-21']);
  });
});

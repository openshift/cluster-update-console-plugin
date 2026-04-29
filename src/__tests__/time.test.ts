import { formatDate, formatDuration } from '../utils/time';

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2026-03-15T00:00:00Z');
    expect(result).toBeTruthy();
    expect(result).not.toBe('2026-03-15T00:00:00Z');
  });

  it('returns the original string for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
    expect(formatDate('')).toBe('');
  });
});

describe('formatDuration', () => {
  it('formats minutes only', () => {
    const start = '2026-01-01T00:00:00Z';
    const end = '2026-01-01T00:35:00Z';
    expect(formatDuration(start, end)).toBe('35m');
  });

  it('formats hours and minutes', () => {
    const start = '2026-01-01T00:00:00Z';
    const end = '2026-01-01T02:15:00Z';
    expect(formatDuration(start, end)).toBe('2h 15m');
  });

  it('formats exact hours without minutes', () => {
    const start = '2026-01-01T00:00:00Z';
    const end = '2026-01-01T03:00:00Z';
    expect(formatDuration(start, end)).toBe('3h');
  });

  it('returns 0m for zero duration', () => {
    const start = '2026-01-01T00:00:00Z';
    expect(formatDuration(start, start)).toBe('0m');
  });

  it('uses Date.now() when no end time is provided', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();
    const result = formatDuration(fiveMinutesAgo);
    expect(result).toMatch(/^\d+m$/);
  });
});

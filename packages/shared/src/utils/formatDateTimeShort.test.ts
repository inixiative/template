import { describe, expect, it } from 'bun:test';
import { formatDateTimeShort } from '@template/shared/utils/formatDateTimeShort';

describe('formatDateTimeShort', () => {
  it('formats an instant in the given time zone with its abbreviation', () => {
    expect(formatDateTimeShort('2026-04-30T20:00:00Z', 'America/Chicago')).toBe(
      'Apr 30, 3:00 PM CDT',
    );
  });

  it('prints the wall clock of the target zone, not the host', () => {
    expect(formatDateTimeShort('2026-04-27T22:00:00Z', 'America/Los_Angeles')).toBe(
      'Apr 27, 3:00 PM PDT',
    );
    expect(formatDateTimeShort('2026-04-27T22:00:00Z', 'America/New_York')).toBe(
      'Apr 27, 6:00 PM EDT',
    );
  });

  it('prints UTC', () => {
    expect(formatDateTimeShort('2026-04-30T20:00:00Z', 'UTC')).toBe('Apr 30, 8:00 PM UTC');
  });

  it('prints a Date the same as its ISO string', () => {
    expect(formatDateTimeShort(new Date('2026-04-30T20:00:00Z'), 'America/Chicago')).toBe(
      'Apr 30, 3:00 PM CDT',
    );
  });

  it('returns null for an invalid date', () => {
    expect(formatDateTimeShort('not-a-date', 'America/Chicago')).toBeNull();
    expect(formatDateTimeShort('', 'America/Chicago')).toBeNull();
  });
});

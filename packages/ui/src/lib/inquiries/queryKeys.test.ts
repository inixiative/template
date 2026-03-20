import { describe, expect, it } from 'bun:test';
import { inquiryFiltersToSearchFields, mergeInquiryFilters } from '@template/ui/lib/inquiries/queryKeys';

describe('inquiryFiltersToSearchFields', () => {
  it('empty filters returns empty object', () => {
    expect(inquiryFiltersToSearchFields({})).toEqual({});
  });

  it('types filter serializes as in array', () => {
    const result = inquiryFiltersToSearchFields({ types: ['createSpace', 'transferSpace'] });
    expect(result.type).toEqual({ in: ['createSpace', 'transferSpace'] });
  });

  it('empty types array omits the filter', () => {
    const result = inquiryFiltersToSearchFields({ types: [] });
    expect(result).not.toHaveProperty('type');
  });

  it('statuses filter serializes as in array', () => {
    const result = inquiryFiltersToSearchFields({ statuses: ['sent', 'approved'] });
    expect(result.status).toEqual({ in: ['sent', 'approved'] });
  });

  it('includeExpired: false with explicit now uses that timestamp', () => {
    const now = new Date('2024-06-15T10:30:00.000Z');
    const result = inquiryFiltersToSearchFields({ includeExpired: false }, now);
    expect((result.expiresAt as { gte: string }).gte).toBe('2024-06-15T10:30:00.000Z');
  });

  it('includeExpired: false with same now reference is stable (no key churn)', () => {
    const now = new Date('2024-06-15T10:30:00.000Z');
    const r1 = inquiryFiltersToSearchFields({ includeExpired: false }, now);
    const r2 = inquiryFiltersToSearchFields({ includeExpired: false }, now);
    expect(r1.expiresAt).toEqual(r2.expiresAt);
  });

  it('includeExpired: true does not add expiresAt filter', () => {
    const result = inquiryFiltersToSearchFields({ includeExpired: true });
    expect(result).not.toHaveProperty('expiresAt');
  });

  it('includeExpired: undefined does not add expiresAt filter', () => {
    const result = inquiryFiltersToSearchFields({});
    expect(result).not.toHaveProperty('expiresAt');
  });

  it('combined filters emit all fields', () => {
    const now = new Date('2024-06-15T10:30:00.000Z');
    const result = inquiryFiltersToSearchFields(
      { types: ['createSpace'], statuses: ['sent'], includeExpired: false },
      now,
    );
    expect(result.type).toEqual({ in: ['createSpace'] });
    expect(result.status).toEqual({ in: ['sent'] });
    expect(result.expiresAt).toEqual({ gte: '2024-06-15T10:30:00.000Z' });
  });

  // Known limitation: expiresAt[gte] uses SQL >= semantics, which excludes NULL rows.
  // Inquiries with no expiry date (null expiresAt = never expires) are incorrectly hidden
  // when includeExpired:false. Fix requires a dedicated server-side includeExpired param
  // that emits: WHERE expiresAt IS NULL OR expiresAt >= now
  it('NOTE — null-expiry limitation: filter only guards via gte, no OR NULL clause', () => {
    const now = new Date('2024-06-15T10:30:00.000Z');
    const result = inquiryFiltersToSearchFields({ includeExpired: false }, now);
    // Current impl: only gte, no OR condition for null rows
    expect(result.expiresAt).toEqual({ gte: '2024-06-15T10:30:00.000Z' });
    expect(result).not.toHaveProperty('OR');
  });
});

describe('mergeInquiryFilters', () => {
  it('external types bound internal values and allow narrowing by overlap', () => {
    const merged = mergeInquiryFilters({ types: ['createSpace', 'transferSpace'] }, { types: ['transferSpace'] });
    expect(merged.types).toEqual(['transferSpace']);
  });

  it('falls back to internal when external is undefined', () => {
    const merged = mergeInquiryFilters(undefined, { types: ['transferSpace'] });
    expect(merged.types).toEqual(['transferSpace']);
  });

  it('clamps internal values back to external bounds when there is no overlap', () => {
    const merged = mergeInquiryFilters({ types: ['createSpace'] }, { types: ['transferSpace'] });
    expect(merged.types).toEqual(['createSpace']);
  });

  it('narrowing works for statuses too', () => {
    const merged = mergeInquiryFilters({ statuses: ['sent', 'approved'] }, { statuses: ['approved'] });
    expect(merged.statuses).toEqual(['approved']);
  });

  it('external includeExpired: false cannot be widened by internal true', () => {
    const merged = mergeInquiryFilters({ includeExpired: false }, { includeExpired: true });
    expect(merged.includeExpired).toBe(false);
  });

  it('external includeExpired: true still allows internal false to narrow', () => {
    const merged = mergeInquiryFilters({ includeExpired: true }, { includeExpired: false });
    expect(merged.includeExpired).toBe(false);
  });

  it('internal includeExpired used when external is undefined', () => {
    const merged = mergeInquiryFilters({}, { includeExpired: false });
    expect(merged.includeExpired).toBe(false);
  });

  it('undefined external does not clobber internal statuses', () => {
    const merged = mergeInquiryFilters(undefined, { statuses: ['sent', 'approved'] });
    expect(merged.statuses).toEqual(['sent', 'approved']);
  });
});

import { describe, expect, it } from 'bun:test';
import { bucketOf, inSample, randomOffset, SAMPLE_OFFSETS } from '#/modules/segment/lib/sample';

const id = '019930a1-6f2b-7c3d-8e4f-0123456789ab';

describe('sample', () => {
  it('reads three hex digits starting at the offset, counted from the tail of the id', () => {
    expect(bucketOf(id, 0)).toBeCloseTo((0x9ab / 4096) * 100);
    expect(bucketOf(id, 1)).toBeCloseTo((0x89a / 4096) * 100);
    expect(bucketOf(id, 12)).toBeCloseTo((0xe4f / 4096) * 100);
    expect(SAMPLE_OFFSETS).toBe(13);
  });

  it('admits an id when its bucket sits in [from, to) and ignores a malformed sample', () => {
    const bucket = bucketOf(id, 0);
    expect(inSample(id, { from: 0, to: 100, offset: 0 })).toBe(true);
    expect(inSample(id, { from: bucket, to: 100, offset: 0 })).toBe(true);
    expect(inSample(id, { from: 0, to: bucket, offset: 0 })).toBe(false);
    expect(inSample(id, { from: bucket + 1, to: bucket + 2, offset: 0 })).toBe(false);
    expect(inSample(id, null)).toBe(true);
    expect(inSample(id, { from: 0, to: 100 })).toBe(true);
    expect(inSample(id, { from: 50, to: 10, offset: 0 })).toBe(true);
  });

  it('a random offset always lands within the offset count', () => {
    for (let i = 0; i < 200; i++) {
      const offset = randomOffset();
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(SAMPLE_OFFSETS);
      expect(Number.isInteger(offset)).toBe(true);
    }
  });
});

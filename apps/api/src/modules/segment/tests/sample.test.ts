import { describe, expect, it } from 'bun:test';
import { bucketOf, inSample, SAMPLE_OFFSETS } from '#/modules/segment/lib/sample';

const id = '019930a1-6f2b-7c3d-8e4f-0123456789ab';

describe('sample', () => {
  it('reads three hex digits starting at the offset, counted from the tail of the id', () => {
    expect(bucketOf(id, 0)).toBeCloseTo((0x9ab / 4096) * 100);
    expect(bucketOf(id, 1)).toBeCloseTo((0x89a / 4096) * 100);
    expect(bucketOf(id, 12)).toBeCloseTo((0xe4f / 4096) * 100);
    expect(SAMPLE_OFFSETS).toBe(13);
  });

  it('admits an id when its bucket sits in [from, to) and ignores a malformed range', () => {
    const bucket = bucketOf(id, 0);
    expect(inSample(id, { from: 0, to: 100 }, 0)).toBe(true);
    expect(inSample(id, { from: bucket, to: 100 }, 0)).toBe(true);
    expect(inSample(id, { from: 0, to: bucket }, 0)).toBe(false);
    expect(inSample(id, { from: bucket + 1, to: bucket + 2 }, 0)).toBe(false);
    expect(inSample(id, null, 0)).toBe(true);
    expect(inSample(id, { from: 50, to: 10 }, 0)).toBe(true);
  });

  it('every id lands in exactly one of two halves at every offset', () => {
    for (let offset = 0; offset < SAMPLE_OFFSETS; offset++) {
      for (let i = 0; i < 50; i++) {
        const candidate = Bun.randomUUIDv7();
        const low = inSample(candidate, { from: 0, to: 50 }, offset);
        const high = inSample(candidate, { from: 50, to: 100 }, offset);
        expect(low !== high).toBe(true);
      }
    }
  });
});

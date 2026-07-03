import { describe, expect, it } from 'bun:test';
import type { LensNarrowing } from '@inixiative/json-rules';
import { useFilteredData } from '@template/ui/hooks/useFilteredData';
import { lensFromSchema } from '@template/ui/lib/lenses/lensFromSchema';
import type { SdkSchema } from '@template/ui/lib/lenses/sdkSchema';
import { act, renderHook } from '@testing-library/react';

const RewardSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    rewardType: { type: 'string' },
    points: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const satisfies SdkSchema;

const lens = lensFromSchema(RewardSchema, 'Reward');

const rows = [
  { id: '1', rewardType: 'physical', points: 5, createdAt: '2026-01-15T00:00:00.000Z' },
  { id: '2', rewardType: 'digital', points: 25, createdAt: '2026-06-15T00:00:00.000Z' },
  { id: '3', rewardType: 'physical', points: 50, createdAt: '2026-06-20T00:00:00.000Z' },
];

describe('useFilteredData', () => {
  it('starts unfiltered and filters on setRule', () => {
    const { result } = renderHook(() => useFilteredData(rows, lens));
    expect(result.current.data).toHaveLength(3);

    act(() => result.current.setRule({ field: 'rewardType', operator: 'equals', value: 'physical' }));
    expect(result.current.data.map((r) => r.id)).toEqual(['1', '3']);
  });

  it('coercion-stamps rules from the lens — widget-authored values match wire rows', () => {
    const { result } = renderHook(() => useFilteredData(rows, lens));

    // stringified number from a text input
    act(() => result.current.setRule({ field: 'points', operator: 'greaterThan', value: '10' }));
    expect(result.current.data.map((r) => r.id)).toEqual(['2', '3']);

    // date-only string from a date picker against ISO datetime rows
    act(() => result.current.setRule({ field: 'createdAt', operator: 'greaterThanEquals', value: '2026-06-15' }));
    expect(result.current.data.map((r) => r.id)).toEqual(['2', '3']);
  });

  it('exposes a surface with row-materialized options that round-trip through a rule', () => {
    const narrowing: LensNarrowing = { parent: lens, root: { sources: { points: true } } };
    const { result } = renderHook(() => useFilteredData(rows, narrowing));

    const options = result.current.surface?.maps.sdk.models.Reward.fields.points.options;
    expect(options?.map((o) => o.value)).toEqual(['5', '25', '50']);

    // Picking an option value (a string) filters the numeric column via coercion.
    const picked = options?.[1].value;
    act(() => result.current.setRule({ field: 'points', operator: 'equals', value: picked }));
    expect(result.current.data.map((r) => r.id)).toEqual(['2']);
  });

  it('returns no surface without a lens and still filters', () => {
    const { result } = renderHook(() => useFilteredData(rows));
    expect(result.current.surface).toBeUndefined();
    act(() => result.current.setRule({ field: 'id', operator: 'equals', value: '1' }));
    expect(result.current.data.map((r) => r.id)).toEqual(['1']);
  });
});

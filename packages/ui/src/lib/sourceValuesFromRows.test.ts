import { describe, expect, it } from 'bun:test';
import type { LensNarrowing } from '@inixiative/json-rules';
import { lensFromSchema, type SdkSchema } from '@template/ui/lib/lensFromSchema';
import { sourceValuesFromRows } from '@template/ui/lib/sourceValuesFromRows';

const RewardSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    rewardType: { type: 'string' },
    regionId: { type: 'string' },
    regionName: { type: 'string' },
    isActive: { type: 'boolean' },
    priority: { type: 'integer' },
    tags: { type: 'array', items: { type: 'string' } },
    brand: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tier: { type: 'string' },
      },
    },
  },
} as const satisfies SdkSchema;

const lens = lensFromSchema(RewardSchema, 'Reward');

const rows = [
  {
    id: '1',
    rewardType: 'physical',
    regionId: 'us',
    regionName: 'United States',
    isActive: true,
    priority: 2,
    tags: ['featured', 'new'],
    brand: { id: 'b1', tier: 'gold' },
  },
  {
    id: '2',
    rewardType: 'digital',
    regionId: 'eu',
    regionName: 'Europe',
    isActive: true,
    priority: 10,
    tags: ['featured'],
    brand: { id: 'b2', tier: 'silver' },
  },
  {
    id: '3',
    rewardType: 'physical',
    regionId: 'us',
    regionName: 'United States',
    isActive: false,
    priority: 1,
    tags: [],
    brand: { id: 'b3', tier: 'gold' },
  },
  {
    id: '4',
    rewardType: null,
    regionId: 'apac',
    regionName: 'Asia Pacific',
    isActive: true,
    priority: 3,
    tags: ['clearance'],
    brand: { id: 'b4', tier: 'bronze' },
  },
];

describe('sourceValuesFromRows', () => {
  it('materializes distinct sorted options for a root sourced field, skipping nulls', () => {
    const narrowing: LensNarrowing = { parent: lens, root: { sources: { rewardType: true } } };
    const [sv] = sourceValuesFromRows(narrowing, rows);
    expect(sv).toEqual({
      path: 'Reward',
      mapName: 'sdk',
      model: 'Reward',
      field: 'rewardType',
      options: [{ value: 'digital' }, { value: 'physical' }],
    });
  });

  it('co-selects a sibling label column from a SourceSpec', () => {
    const narrowing: LensNarrowing = {
      parent: lens,
      root: { sources: { regionId: { label: 'regionName' } } },
    };
    const [sv] = sourceValuesFromRows(narrowing, rows);
    expect(sv.options).toEqual([
      { value: 'apac', label: 'Asia Pacific' },
      { value: 'eu', label: 'Europe' },
      { value: 'us', label: 'United States' },
    ]);
  });

  it('applies the source eligibility where over the rows', () => {
    const narrowing: LensNarrowing = {
      parent: lens,
      root: {
        sources: { rewardType: { where: { field: 'isActive', operator: 'equals', value: true } } },
      },
    };
    const [sv] = sourceValuesFromRows(narrowing, rows);
    expect(sv.options).toEqual([{ value: 'digital' }, { value: 'physical' }]);
  });

  it("ignores the visit's data-narrowing where — rows are lens-scoped by contract", () => {
    const narrowing: LensNarrowing = {
      parent: lens,
      root: {
        where: { field: 'isActive', operator: 'equals', value: false },
        sources: { rewardType: true },
      },
    };
    const [sv] = sourceValuesFromRows(narrowing, rows);
    expect(sv.options).toEqual([{ value: 'digital' }, { value: 'physical' }]);
  });

  it('resolves a bind-parameterized eligibility where via CheckOptions', () => {
    const narrowing: LensNarrowing = {
      parent: lens,
      root: {
        sources: { rewardType: { where: { field: 'regionId', operator: 'equals', bind: 'region' } } },
      },
    };
    const [sv] = sourceValuesFromRows(narrowing, rows, { bindings: { region: 'us' } });
    expect(sv.options).toEqual([{ value: 'physical' }]);
  });

  it('flattens scalar-list sourced fields to one option per element', () => {
    const narrowing: LensNarrowing = { parent: lens, root: { sources: { tags: true } } };
    const [sv] = sourceValuesFromRows(narrowing, rows);
    expect(sv.options).toEqual([{ value: 'clearance' }, { value: 'featured' }, { value: 'new' }]);
  });

  it('sorts numeric values numerically, not lexicographically', () => {
    const narrowing: LensNarrowing = { parent: lens, root: { sources: { priority: true } } };
    const [sv] = sourceValuesFromRows(narrowing, rows);
    expect(sv.options.map((o) => o.value)).toEqual(['1', '2', '3', '10']);
  });

  it('prefers the first non-null label when rows disagree', () => {
    const sparseRows = [
      { regionId: 'us', regionName: null },
      { regionId: 'us', regionName: 'United States' },
    ];
    const narrowing: LensNarrowing = {
      parent: lens,
      root: { sources: { regionId: { label: 'regionName' } } },
    };
    const [sv] = sourceValuesFromRows(narrowing, sparseRows);
    expect(sv.options).toEqual([{ value: 'us', label: 'United States' }]);
  });

  it('materializes sourced fields on relation-traversed paths', () => {
    const narrowing: LensNarrowing = {
      parent: lens,
      root: { relations: { brand: { sources: { tier: true } } } },
    };
    const values = sourceValuesFromRows(narrowing, rows);
    const brandTier = values.find((sv) => sv.path === 'Reward.brand');
    expect(brandTier).toEqual({
      path: 'Reward.brand',
      mapName: 'sdk',
      model: 'Reward.brand',
      field: 'tier',
      options: [{ value: 'bronze' }, { value: 'gold' }, { value: 'silver' }],
    });
  });

  it('returns nothing when no sources are declared', () => {
    expect(sourceValuesFromRows(lens, rows)).toEqual([]);
  });
});

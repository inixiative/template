import { afterAll, describe, expect, it } from 'bun:test';
import {
  type Bridge,
  type Condition,
  createLens,
  type FieldMap,
  indexBridges,
  type LensNarrowing,
  type SourceQuery,
  toSourceQueries,
  UsageError,
} from '@inixiative/json-rules';
import { db } from '@template/db/client';
import { prismaMap } from '@template/db/generated/prismaMap';
import { lensFor } from '@template/db/lens';
import {
  cleanupTouchedTables,
  createTag,
  createTagAttachment,
  createUser,
} from '@template/db/test';
import { sourceQueryValues } from '@template/db/utils/sourceQueryValues';
import { sourceQueryWhere } from '@template/db/utils/sourceQueryWhere';
import { deadRuleReferences } from '@template/db/validations/deadRuleReferences';

const busyTags: LensNarrowing = {
  parent: lensFor('Tag'),
  root: {
    sources: {
      id: {
        where: { field: 'attachments', arrayOperator: 'atLeast', count: 2, condition: true },
      },
    },
  },
};

afterAll(async () => {
  await cleanupTouchedTables(db);
});

describe('a stepped source — a count the where resolves to an id set first', () => {
  it('compiles to steps, and a reference outside the rows its count holds for is missing', async () => {
    const sources = toSourceQueries(busyTags);
    expect(sources[0]?.prisma.steps?.length).toBeGreaterThan(0);

    const busy = (await createTag()).entity;
    const idle = (await createTag()).entity;
    for (let i = 0; i < 2; i++) {
      const { entity: user } = await createUser();
      await createTagAttachment({ resourceModel: 'User', tagId: busy.id, userId: user.id });
    }

    const dead = await deadRuleReferences([
      {
        lens: busyTags,
        references: [
          { model: 'Tag', id: busy.id },
          { model: 'Tag', id: idle.id },
        ],
      },
    ]);
    expect(dead).toEqual([{ model: 'Tag', id: idle.id, state: 'missing' }]);
  });
});

describe('a source across a bridge — its rows are candidates, re-checked with the far side', () => {
  const crm: FieldMap = {
    models: {
      Badge: {
        fields: {
          id: { kind: 'scalar', type: 'String' },
          tagId: { kind: 'scalar', type: 'String' },
          tier: { kind: 'scalar', type: 'String' },
        },
      },
    },
  };
  const bridges: Bridge[] = [
    {
      endpoints: [
        { fieldMap: 'prisma', model: 'Tag', on: 'id' },
        { fieldMap: 'crm', model: 'Badge', on: 'tagId' },
      ],
      cardinality: 'oneToOne',
    },
  ];
  const maps = { prisma: prismaMap as unknown as FieldMap, crm };
  const goldTags: LensNarrowing = {
    parent: createLens({ maps, bridges, mapName: 'prisma', model: 'Tag' }),
    root: {
      relations: { 'crm:Badge': {} },
      sources: {
        id: { field: 'crm:Badge.tier', operator: 'equals', value: 'gold' } as Condition,
      },
    },
  };

  const fixture = async () => {
    const gold = (await createTag()).entity;
    const silver = (await createTag()).entity;
    const badges = [
      { id: 'b-gold', tagId: gold.id, tier: 'gold' },
      { id: 'b-silver', tagId: silver.id, tier: 'silver' },
    ];
    const dictionary = indexBridges({ maps, bridges }, { 'crm:Badge': badges });
    const byTag = dictionary.crm?.Badge?.tagId as Record<string, unknown>;
    const farSide = async (_query: SourceQuery, candidates: Record<string, unknown>[]) =>
      candidates.map((row) => ({ ...row, 'crm:Badge': byTag[String(row.id)] ?? null }));
    const query = toSourceQueries(goldTags).find((source) => source.field === 'id')!;
    return { gold, silver, farSide, query, ours: { id: { in: [gold.id, silver.id] } } };
  };

  it('compiles a real query that over-fetches, carrying the recheck', async () => {
    const { query, ours } = await fixture();
    expect(query.recheck).toBeDefined();
    const candidates = await db.tag.findMany({ where: { AND: [query.prisma.where, ours] } });
    expect(candidates).toHaveLength(2);
  });

  it('offers only the candidates the recheck holds for', async () => {
    const { gold, silver, farSide, query } = await fixture();
    const { options } = await sourceQueryValues(query, { lens: goldTags, farSide });
    const offered = options.map((option) => option.value);
    expect(offered).toContain(gold.id);
    expect(offered).not.toContain(silver.id);
  });

  it('pins a where to the re-checked rows', async () => {
    const { gold, farSide, query, ours } = await fixture();
    const where = await sourceQueryWhere(query, { lens: goldTags, farSide });
    const rows = await db.tag.findMany({ where: { AND: [where, ours] }, select: { id: true } });
    expect(rows).toEqual([{ id: gold.id }]);
  });

  it('refuses candidates with no far side loaded rather than offer them', async () => {
    const { query } = await fixture();
    await expect(sourceQueryValues(query, { lens: goldTags })).rejects.toBeInstanceOf(UsageError);
  });
});

describe('a reference is checked under the lens of the scope that holds it, not the first one that has the model', () => {
  const byName = (value: string): LensNarrowing => ({
    parent: lensFor('Tag'),
    root: { sources: { id: { where: { field: 'name', operator: 'equals', value } } } },
  });

  it("a row one slot's source holds is still missing in another slot that references it", async () => {
    const a = (await createTag({ name: 'slot-a' })).entity;
    const b = (await createTag({ name: 'slot-b' })).entity;

    const dead = await deadRuleReferences([
      { lens: byName('slot-a'), references: [{ model: 'Tag', id: a.id }] },
      {
        lens: byName('slot-b'),
        references: [
          { model: 'Tag', id: a.id },
          { model: 'Tag', id: b.id },
        ],
      },
    ]);

    expect(dead).toEqual([{ model: 'Tag', id: a.id, state: 'missing' }]);
  });
});

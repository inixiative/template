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
import { admitRuleReferences } from '@template/db/utils/admitRuleReferences';
import { sourceQueryValues } from '@template/db/utils/sourceQueryValues';
import { sourceQueryWhere } from '@template/db/utils/sourceQueryWhere';

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
  it('compiles to steps, and admits exactly the rows its count holds for', async () => {
    const sources = toSourceQueries(busyTags);
    expect(sources[0]?.prisma.steps?.length).toBeGreaterThan(0);

    const busy = (await createTag()).entity;
    const idle = (await createTag()).entity;
    for (let i = 0; i < 2; i++) {
      const { entity: user } = await createUser();
      await createTagAttachment({ tagId: busy.id, userId: user.id });
    }

    const { admitted, unadmitted } = await admitRuleReferences({
      scopes: [
        {
          lens: busyTags,
          references: [
            { model: 'Tag', id: busy.id },
            { model: 'Tag', id: idle.id },
          ],
        },
      ],
    });
    expect(admitted).toEqual([{ model: 'Tag', id: busy.id }]);
    expect(unadmitted).toEqual([{ model: 'Tag', id: idle.id }]);
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
    const { gold, farSide, query, ours } = await fixture();
    const { options } = await sourceQueryValues(query, { lens: goldTags, farSide }, ours);
    expect(options.map((option) => option.value)).toEqual([gold.id]);
  });

  it('pins a where to the re-checked rows', async () => {
    const { gold, farSide, query, ours } = await fixture();
    const where = await sourceQueryWhere(query, { lens: goldTags, farSide });
    const rows = await db.tag.findMany({ where: { AND: [where, ours] }, select: { id: true } });
    expect(rows).toEqual([{ id: gold.id }]);
  });

  it('admits a reference only when the far side holds', async () => {
    const { gold, silver, farSide } = await fixture();
    const { admitted, unadmitted } = await admitRuleReferences({
      scopes: [
        {
          lens: goldTags,
          references: [
            { model: 'Tag', id: gold.id },
            { model: 'Tag', id: silver.id },
          ],
        },
      ],
      farSide,
    });
    expect(admitted).toEqual([{ model: 'Tag', id: gold.id }]);
    expect(unadmitted).toEqual([{ model: 'Tag', id: silver.id }]);
  });

  it('refuses candidates with no far side loaded rather than offer them', async () => {
    const { query, ours } = await fixture();
    await expect(sourceQueryValues(query, { lens: goldTags }, ours)).rejects.toBeInstanceOf(
      UsageError,
    );
  });
});

describe('a reference is admitted by the lens it was named through, not the first one that has the model', () => {
  const named = (value: string): LensNarrowing => ({
    parent: lensFor('Tag'),
    root: { sources: { id: { where: { field: 'name', operator: 'equals', value } } } },
  });

  it("a row one slot's source admits is still refused when another slot named it", async () => {
    const a = (await createTag({ name: 'slot-a' })).entity;
    const b = (await createTag({ name: 'slot-b' })).entity;

    const { admitted, unadmitted } = await admitRuleReferences({
      scopes: [
        { lens: named('slot-a'), references: [{ model: 'Tag', id: a.id }] },
        {
          lens: named('slot-b'),
          references: [
            { model: 'Tag', id: a.id },
            { model: 'Tag', id: b.id },
          ],
        },
      ],
    });

    expect(admitted).toEqual([{ model: 'Tag', id: b.id }]);
    expect(unadmitted).toEqual([{ model: 'Tag', id: a.id }]);
  });
});

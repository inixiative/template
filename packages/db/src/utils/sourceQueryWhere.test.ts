import { afterAll, describe, expect, it } from 'bun:test';
import { type LensNarrowing, toSourceQueries } from '@inixiative/json-rules';
import { db } from '@template/db/client';
import { lensFor } from '@template/db/lens';
import {
  cleanupTouchedTables,
  createTag,
  createTagAttachment,
  createUser,
} from '@template/db/test';
import { admitRuleReferences } from '@template/db/utils/admitRuleReferences';

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

describe('a stepped source — a count the where resolves to an id set first', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('compiles to steps, and admits exactly the rows its count holds for', async () => {
    const sources = toSourceQueries(busyTags);
    expect(sources[0]?.prisma?.steps?.length).toBeGreaterThan(0);

    const busy = (await createTag()).entity;
    const idle = (await createTag()).entity;
    for (let i = 0; i < 2; i++) {
      const { entity: user } = await createUser();
      await createTagAttachment({ tagId: busy.id, userId: user.id });
    }

    const { admitted, unadmitted } = await admitRuleReferences(sources, [
      { model: 'Tag', id: busy.id },
      { model: 'Tag', id: idle.id },
    ]);
    expect(admitted).toEqual([{ model: 'Tag', id: busy.id }]);
    expect(unadmitted).toEqual([{ model: 'Tag', id: idle.id }]);
  });
});

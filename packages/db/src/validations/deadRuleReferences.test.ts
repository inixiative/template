import { afterAll, describe, expect, it } from 'bun:test';
import { type LensNarrowing, toSourceQueries } from '@inixiative/json-rules';
import { db } from '@template/db/client';
import { lensFor } from '@template/db/lens/lensFor';
import { cleanupTouchedTables, createOrganization } from '@template/db/test';
import { sourceQueryValues } from '@template/db/utils/sourceQueryValues';
import { deadRuleReferences } from '@template/db/validations/deadRuleReferences';

const organizations: LensNarrowing = {
  parent: lensFor('Organization'),
  root: { sources: { id: true } },
};

describe('the owner scope of a rule is read for the ids it names, never the whole table', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  it('a source read among some values answers those values only, in one query', async () => {
    const { entity: named } = await createOrganization();
    const { entity: other } = await createOrganization();
    const [source] = toSourceQueries(organizations).filter((query) => query.field === 'id');

    const among = await sourceQueryValues(source!, { lens: organizations, among: [named.id] });
    expect(among.options.map((option) => option.value)).toEqual([named.id]);

    const whole = await sourceQueryValues(source!, { lens: organizations });
    expect(whole.options.map((option) => option.value)).toContain(other.id);
  });

  it('a named row that exists is alive; one that does not is missing', async () => {
    const { entity: named } = await createOrganization();
    const gone = Bun.randomUUIDv7();
    expect(
      await deadRuleReferences([
        {
          lens: organizations,
          references: [
            { model: 'Organization', id: named.id },
            { model: 'Organization', id: gone },
          ],
        },
      ]),
    ).toEqual([{ model: 'Organization', id: gone, state: 'missing' }]);
  });
});

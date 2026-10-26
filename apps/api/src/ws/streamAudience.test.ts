import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import {
  cleanupTouchedTables,
  createContact,
  createOrganizationUser,
  createUser,
} from '@template/db/test';
import {
  defineStream,
  STREAM_DEFINITIONS,
  type StreamFamily,
  type StreamParams,
} from '@template/shared/ws';
import { z } from 'zod';
import { type AudienceCaller, expectStreamAudience } from '#tests/expectStreamAudience';
import { createBearerToken } from '#tests/utils/createBearerToken';

type AudienceFixture<F extends StreamFamily> = () => Promise<{
  params: StreamParams<(typeof STREAM_DEFINITIONS)[F]>;
  callers: AudienceCaller[];
}>;

const bearer = async (user: Parameters<typeof createBearerToken>[0]) => ({
  authorization: (await createBearerToken(user)).authorization,
});

const STREAM_AUDIENCE_FIXTURES: { [F in StreamFamily]: AudienceFixture<F> } = {
  organizationReadManyContacts: async () => {
    const { context: owner } = await createOrganizationUser({ role: 'owner' });
    const organization = owner.organization;
    const callers: AudienceCaller[] = [{ label: 'owner', headers: await bearer(owner.user) }];
    for (const role of ['admin', 'member', 'viewer'] as const) {
      const { context } = await createOrganizationUser({ role }, { organization });
      callers.push({ label: role, headers: await bearer(context.user) });
    }
    for (let i = 0; i < 3; i++) {
      await createContact(
        { ownerModel: 'Organization', organizationId: organization.id },
        { organization },
      );
    }
    return { params: { id: organization.id }, callers };
  },
};

describe('stream audience', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  for (const family of Object.keys(STREAM_DEFINITIONS) as StreamFamily[]) {
    const definition = STREAM_DEFINITIONS[family];

    it(`${family}: every authorized caller gets the data its audience declares`, async () => {
      const { params, callers } = await STREAM_AUDIENCE_FIXTURES[family]();
      expect(callers.length).toBeGreaterThan(1);
      await expectStreamAudience(definition, params, callers);
    });
  }

  it('fails a shared stream over a route whose rows depend on the caller', async () => {
    const perCaller = defineStream('meReadManyContacts', {
      kind: 'list',
      audience: 'shared',
      params: z.object({}),
    });
    const { entity: alice } = await createUser();
    const { entity: bob } = await createUser();
    await createContact({ ownerModel: 'User' }, { user: alice });

    await expect(
      expectStreamAudience(perCaller, {}, [
        { label: 'alice', headers: await bearer(alice) },
        { label: 'bob', headers: await bearer(bob) },
      ]),
    ).rejects.toThrow("declared audience 'shared'");
  });

  it('passes the same route once it is declared perRecipient', async () => {
    const perRecipient = defineStream('meReadManyContacts', {
      kind: 'list',
      audience: 'perRecipient',
      params: z.object({}),
    });
    const { entity: alice } = await createUser();
    const { entity: bob } = await createUser();
    await createContact({ ownerModel: 'User' }, { user: alice });

    await expectStreamAudience(perRecipient, {}, [
      { label: 'alice', headers: await bearer(alice) },
      { label: 'bob', headers: await bearer(bob) },
    ]);
  });
});

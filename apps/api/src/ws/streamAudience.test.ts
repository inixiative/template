import { afterAll, describe, expect, it } from 'bun:test';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '@template/db';
import { STREAM_DEFINITIONS, type StreamFamily } from '@template/db/streams';
import { cleanupTouchedTables, createContact, createOrganizationUser, createUser } from '@template/db/test';
import { defineStream, listStreamSchemas, type StreamParams } from '@template/shared/ws';
import { z } from 'zod';
import { isPerCallerScope, scopeNarrowing } from '#/middleware/resources/scopeNarrowing';
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
      await createContact({ ownerModel: 'Organization', organizationId: organization.id }, { organization });
    }
    return { params: { id: organization.id }, callers };
  },
};

const routeConfig = async (operationId: string): Promise<{ middleware?: unknown } | null> => {
  const modulesDir = resolve(import.meta.dirname, '../modules');
  for (const module of readdirSync(modulesDir)) {
    const file = resolve(modulesDir, module, 'routes', `${operationId}.ts`);
    if (!(await Bun.file(file).exists())) continue;
    const routeModule = await import(file);
    return routeModule[`${operationId}Route`] ?? routeModule.default ?? null;
  }
  return null;
};

const usesPerCallerScope = (route: { middleware?: unknown } | null): boolean =>
  [route?.middleware].flat().some(isPerCallerScope);

describe('stream audience', () => {
  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  for (const family of Object.keys(STREAM_DEFINITIONS) as StreamFamily[]) {
    const definition = STREAM_DEFINITIONS[family];

    it(`${family}: a 'shared' stream's route adds no per-caller lens scope`, async () => {
      const route = await routeConfig(family);
      expect(route).not.toBeNull();
      if (definition.audience === 'shared') expect(usesPerCallerScope(route)).toBe(false);
    });

    it(`${family}: every authorized caller gets the data its audience declares`, async () => {
      const { params, callers } = await STREAM_AUDIENCE_FIXTURES[family]();
      expect(callers.length).toBeGreaterThan(1);
      await expectStreamAudience(definition, params, callers);
    });
  }

  it('fails a shared stream over a route whose rows depend on the caller', async () => {
    const perCaller = defineStream('meReadManyContacts', {
      audience: 'shared',
      params: z.object({}),
      ...listStreamSchemas(z.object({ id: z.string(), updatedAt: z.string() })),
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
      audience: 'perRecipient',
      params: z.object({}),
      ...listStreamSchemas(z.object({ id: z.string(), updatedAt: z.string() })),
    });
    const { entity: alice } = await createUser();
    const { entity: bob } = await createUser();
    await createContact({ ownerModel: 'User' }, { user: alice });

    await expectStreamAudience(perRecipient, {}, [
      { label: 'alice', headers: await bearer(alice) },
      { label: 'bob', headers: await bearer(bob) },
    ]);
  });

  it('detects a lens scope that narrows rows per request', () => {
    const scoped = { middleware: [scopeNarrowing(() => ({ root: {} }))] };
    expect(usesPerCallerScope(scoped)).toBe(true);
    expect(usesPerCallerScope({ middleware: [async () => {}] })).toBe(false);
  });
});

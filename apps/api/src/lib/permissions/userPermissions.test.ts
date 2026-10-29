import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, hydrate, unregisterDbHook } from '@template/db';
import type { Organization, Space, User } from '@template/db/generated/client/client';
import { PlatformRole } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import type { Permix } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { userPermissions } from '#/lib/permissions/userPermissions';
import { jwtAuthMiddleware } from '#/middleware/auth/jwtAuthMiddleware';
import { createTestApp } from '#tests/createTestApp';
import { createUserJwt } from '#tests/utils/createUserJwt';

type Situation = { model: 'user' | 'organization' | 'space'; id: string; action: string };

const answers = async (permix: Permix, situations: Situation[]) =>
  Promise.all(
    situations.map(async ({ model, id, action }) =>
      check(permix, rebacSchema, model, await hydrate(model, { id }), action),
    ),
  );

const { app } = createTestApp({
  mount: [
    (hono) => {
      hono.use('*', jwtAuthMiddleware);
      hono.post('/probe', async (c) =>
        c.json(await answers(c.get('permix'), (await c.req.json()) as Situation[])),
      );
    },
  ],
});

const requestAnswers = async (user: User, situations: Situation[]) =>
  (await (
    await app.request('/probe', {
      method: 'POST',
      headers: {
        authorization: (await createUserJwt(user)).authorization,
        'content-type': 'application/json',
      },
      body: JSON.stringify(situations),
    })
  ).json()) as boolean[];

const builtAnswers = async (user: User, situations: Situation[]) => {
  const permix = await userPermissions(user.id);
  if (!permix) throw new Error('no permissions built');
  return answers(permix, situations);
};

describe("a user's permissions, built for a user who is not the requester", () => {
  let organization: Organization;
  let otherOrganization: Organization;
  let space: Space;
  let admin: User;
  let spaceMember: User;
  let superadmin: User;
  let situations: Situation[];

  beforeAll(async () => {
    registerClearCacheHook();
    ({ entity: organization } = await createOrganization());
    ({ entity: otherOrganization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
    ({
      context: { user: admin },
    } = await createOrganizationUser({ role: 'admin' }, { organization }));
    ({ entity: spaceMember } = await createUser());
    await createSpaceUser({ role: 'member' }, { space, organization, user: spaceMember });
    ({ entity: superadmin } = await createUser({ platformRole: PlatformRole.superadmin }));

    situations = (['read', 'operate', 'manage', 'own'] as const).flatMap((action) => [
      { model: 'organization', id: organization.id, action },
      { model: 'organization', id: otherOrganization.id, action },
      { model: 'space', id: space.id, action },
    ]);
  });

  afterAll(async () => {
    unregisterDbHook('clearCache');
    await cleanupTouchedTables(db);
  });

  it("answers what the user's own JWT request answers: an organization admin", async () => {
    const built = await builtAnswers(admin, situations);
    expect(built).toEqual(await requestAnswers(admin, situations));
    expect(built).toContain(true);
    expect(built).toContain(false);
  });

  it("answers what the user's own JWT request answers: a space member", async () => {
    const built = await builtAnswers(spaceMember, situations);
    expect(built).toEqual(await requestAnswers(spaceMember, situations));
    expect(built).toContain(true);
  });

  it('acting on their own user, user-only actions included', async () => {
    const own: Situation[] = ['read', 'own', 'user.rotateJwts', 'user.redact'].map((action) => ({
      model: 'user',
      id: admin.id,
      action,
    }));
    const built = await builtAnswers(admin, own);
    expect(built).toEqual(await requestAnswers(admin, own));
    expect(built).toEqual([true, true, true, true]);
  });

  it('a superadmin is superadmin', async () => {
    const permix = await userPermissions(superadmin.id);
    expect(permix?.isSuperadmin()).toBe(true);
    expect(await builtAnswers(superadmin, situations)).toEqual(
      await requestAnswers(superadmin, situations),
    );
  });

  it('the actor is that user', async () => {
    const permix = await userPermissions(admin.id);
    expect(permix?.getActor()).toMatchObject({ model: 'User', record: { id: admin.id } });
  });

  it('a user who does not exist has no permissions', async () => {
    expect(await userPermissions(Bun.randomUUIDv7())).toBeNull();
  });
});

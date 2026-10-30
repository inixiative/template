import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { z } from '@hono/zod-openapi';
import { db, type HydratedRecord, hydrate, unregisterDbHook } from '@template/db';
import type { Organization, Role, Space, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createContact,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { createPermissions } from '@template/permissions/client';
import { check, placeUnder, rebacSchema, schemaMap } from '@template/permissions/rebac';
import { app } from '#/app';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { readRoute } from '#/lib/routeTemplates';
import { AUTH_PROBE_HEADER, AUTH_PROBE_SECRET } from '#/lib/utils/authProbe';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
import { createKeyedToken } from '#tests/utils/createKeyedToken';
import { createUserJwt } from '#tests/utils/createUserJwt';

beforeAll(() => registerClearCacheHook());
afterAll(async () => {
  unregisterDbHook('clearCache');
  await cleanupTouchedTables(db);
});

type Headers = Record<string, string>;

const jwt = async (user: User): Promise<Headers> => ({
  authorization: (await createUserJwt(user)).authorization,
});

const bearer = (rawKey: string): Headers => ({ authorization: `Bearer ${rawKey}` });

const userToken = async (user: User, role: Role): Promise<Headers> =>
  bearer((await createKeyedToken({ ownerModel: 'User', role }, { user })).rawKey);

const gate = async (headers: Headers, method: 'GET' | 'POST', path: string) => {
  const response = await app.request(`/api/v1${path}`, {
    method,
    headers: { ...headers, 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify({}) : undefined,
  });
  if (response.status === 403) return 'denied';
  if (response.status === 401) return 'unauthenticated';
  if (response.ok || response.status === 400 || response.status === 422) return 'passes';
  return `unexpected ${response.status}`;
};

describe('submodel actions act on the submodel, under the owner (R38)', () => {
  let organization: Organization;
  let space: Space;
  const org: Record<string, Headers> = {};
  const spc: Record<string, Headers> = {};
  const noSeat: Record<string, Headers> = {};
  let outsider: Headers;
  let spaceOutsider: Headers;

  const anOutsider = async () =>
    jwt((await createOrganizationUser({ role: 'owner' })).context.user);

  const orgRoles = ['owner', 'admin', 'member', 'viewer'] as const;

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
    for (const role of orgRoles) {
      const { context } = await createOrganizationUser({ role }, { organization });
      org[role] = await jwt(context.user);
    }
    for (const role of ['owner', 'admin'] as const) {
      const { context } = await createOrganizationUser({ role }, { organization });
      noSeat[role] = await jwt(context.user);
    }
    for (const role of orgRoles) {
      const { context } = await createOrganizationUser({ role: 'member' }, { organization });
      await createSpaceUser({ role }, { ...context, space });
      spc[role] = await jwt(context.user);
    }
    outsider = await anOutsider();
    spaceOutsider = await anOutsider();
  });

  const statuses = async (callers: Record<string, Headers>, method: 'GET' | 'POST', path: string) =>
    Object.fromEntries(
      await Promise.all(
        Object.entries(callers).map(async ([who, headers]) => [
          who,
          await gate(headers, method, path),
        ]),
      ),
    );

  const outcomes = (
    callers: string[],
    passing: string[],
    fixed: Record<string, string> = {},
  ): Record<string, string> =>
    Object.fromEntries(
      callers.map((who) => [who, fixed[who] ?? (passing.includes(who) ? 'passes' : 'denied')]),
    );

  type Row = { name: string; path: string; create?: string[]; list?: string[] };

  const members = ['owner', 'admin', 'member', 'viewer'];
  const managers = ['owner', 'admin'];
  const operators = ['owner', 'admin', 'member'];

  const expectRow = async (
    callers: Record<string, Headers>,
    at: (path: string) => string,
    row: Row,
  ) => {
    const names = Object.keys(callers);
    if (row.create)
      expect(await statuses(callers, 'POST', at(row.path))).toEqual(outcomes(names, row.create));
    if (row.list)
      expect(await statuses(callers, 'GET', at(row.path))).toEqual(outcomes(names, row.list));
  };

  describe('organization children', () => {
    const rows: Row[] = [
      {
        name: 'contacts: managers create, every member lists',
        path: '/contacts',
        create: managers,
        list: members,
      },
      {
        name: 'integrations: managers create, every member lists',
        path: '/integrations',
        create: managers,
        list: members,
      },
      {
        name: 'webhook subscriptions: operators create, every member lists',
        path: '/webhookSubscriptions',
        create: operators,
        list: members,
      },
      {
        name: 'segments: managers create, every member lists',
        path: '/segments',
        create: managers,
        list: members,
      },
      { name: 'segment reach: managers', path: '/segments/reach', create: managers },
      { name: 'auth providers: only owners create', path: '/authProviders', create: ['owner'] },
      {
        name: 'tokens: only owners list (R38: token list read = own at the owner)',
        path: '/tokens',
        list: ['owner'],
      },
    ];

    for (const row of rows)
      it(row.name, () =>
        expectRow({ ...org, outsider }, (path) => `/organization/${organization.id}${path}`, row),
      );
  });

  describe('space children', () => {
    const withOrgOwner = (callers: string[]) => [...callers, 'orgOwnerNoSeat'];
    const rows: Row[] = [
      {
        name: 'contacts: space managers and org owners create; space members list',
        path: '/contacts',
        create: withOrgOwner(managers),
        list: withOrgOwner(members),
      },
      {
        name: 'integrations: space managers and org owners create; space members list',
        path: '/integrations',
        create: withOrgOwner(managers),
        list: withOrgOwner(members),
      },
      {
        name: 'webhook subscriptions: space operators create; space members list',
        path: '/webhookSubscriptions',
        create: withOrgOwner(operators),
        list: withOrgOwner(members),
      },
      {
        name: 'segments: space managers and org owners create; space members list',
        path: '/segments',
        create: withOrgOwner(managers),
        list: withOrgOwner(members),
      },
      {
        name: 'segment reach: space managers and org owners',
        path: '/segments/reach',
        create: withOrgOwner(managers),
      },
      {
        name: 'tokens: only space owners (and org owners) list',
        path: '/tokens',
        list: withOrgOwner(['owner']),
      },
    ];

    for (const row of rows)
      it(row.name, () =>
        expectRow(
          {
            ...spc,
            orgOwnerNoSeat: noSeat.owner,
            orgAdminNoSeat: noSeat.admin,
            outsider: spaceOutsider,
          },
          (path) => `/space/${space.id}${path}`,
          row,
        ),
      );
  });

  describe('my children (/me)', () => {
    let callers: Record<string, Headers>;
    const memberTokenOutcome = { memberToken: 'unauthenticated' };

    beforeAll(async () => {
      const { entity: organizationUser } = await createOrganizationUser(
        { role: 'owner' },
        { organization },
      );
      const { rawKey } = await createKeyedToken(
        { ownerModel: 'OrganizationUser', role: 'owner' },
        { organizationUser },
      );
      callers = {
        user: await jwt((await createUser()).entity),
        ownerToken: await userToken((await createUser()).entity, 'owner'),
        viewerToken: await userToken((await createUser()).entity, 'viewer'),
        memberToken: bearer(rawKey),
      };
    });

    const rows = [
      {
        name: 'creates need operate on me',
        method: 'POST',
        paths: [
          '/contacts',
          '/flows',
          '/integrations',
          '/webhookSubscriptions',
          '/segments',
          '/segments/reach',
        ],
        passing: ['user', 'ownerToken'],
      },
      {
        name: 'lists need read on me',
        method: 'GET',
        paths: ['/contacts', '/integrations', '/webhookSubscriptions'],
        passing: ['user', 'ownerToken', 'viewerToken'],
      },
      {
        name: 'my tokens: own on me',
        method: 'GET',
        paths: ['/tokens'],
        passing: ['user', 'ownerToken'],
      },
    ] as const;

    for (const row of rows)
      it(row.name, async () => {
        for (const path of row.paths)
          expect([path, await statuses(callers, row.method, `/me${path}`)]).toEqual([
            path,
            outcomes(Object.keys(callers), [...row.passing], memberTokenOutcome),
          ]);
      });
  });

  describe('attempts to get around it', () => {
    it("a body naming another owner changes nothing: the check is on the route's owner", async () => {
      const { entity: other } = await createOrganization();
      const post = (headers: Headers) =>
        app.request(`/api/v1/organization/${organization.id}/contacts`, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ ownerModel: 'Organization', organizationId: other.id }),
        });
      expect((await post(org.admin)).status).toBe(422);
      const { context } = await createOrganizationUser({ role: 'owner' }, { organization: other });
      expect((await post(await jwt(context.user))).status).toBe(403);
    });

    it('a WS subscribe probe answers as the route does', async () => {
      const probe = async (headers: Headers) =>
        (
          await app.request(`/api/v1/organization/${organization.id}/contacts`, {
            headers: { ...headers, [AUTH_PROBE_HEADER]: AUTH_PROBE_SECRET },
          })
        ).status;
      expect(await probe(org.viewer)).toBe(204);
      expect(await probe(await anOutsider())).toBe(403);
    });

    it("a member's stored actions at another organization open nothing here", async () => {
      const { entity: other } = await createOrganization();
      const { context } = await createOrganizationUser(
        {
          role: 'viewer',
          entitlements: [
            {
              resource: 'db:organization',
              anchor: { resource: 'db:organization', id: other.id },
              actions: { manage: true },
            },
          ],
        },
        { organization: other },
      );
      await createOrganizationUser({ role: 'viewer' }, { organization, user: context.user });
      const headers = await jwt(context.user);
      expect(await gate(headers, 'POST', `/organization/${organization.id}/contacts`)).toBe(
        'denied',
      );
      expect(await gate(headers, 'POST', `/organization/${other.id}/contacts`)).toBe('passes');
    });

    it('an entitlement anchored at another organization opens nothing here', async () => {
      const { entity: other } = await createOrganization();
      const { context } = await createOrganizationUser({ role: 'owner' }, { organization: other });
      await createOrganizationUser({ role: 'viewer' }, { organization, user: context.user });
      const { rawKey } = await createKeyedToken(
        {
          ownerModel: 'User',
          role: 'viewer',
          entitlements: [
            {
              resource: 'db:contact',
              anchor: { resource: 'db:organization', id: other.id, path: 'organization' },
              actions: { create: true },
            },
          ],
        },
        { user: context.user },
      );
      const headers = bearer(rawKey);
      expect(await gate(headers, 'POST', `/organization/${organization.id}/contacts`)).toBe(
        'denied',
      );
      expect(await gate(headers, 'POST', `/organization/${other.id}/contacts`)).toBe('passes');
    });

    it("a pseudo record's empty id never matches a grant keyed by a real row's id", async () => {
      const { entity: contact } = await createContact(
        { ownerModel: 'Organization', organizationId: organization.id },
        { organization },
      );
      const permix = createPermissions();
      await permix.setup({ resource: 'db:contact', id: contact.id, actions: { create: true } });
      const [placed] = placeUnder(
        schemaMap,
        'db:contact',
        'organization',
        'db:organization',
        organization,
        { field: 'ownerModel', operator: 'equals', value: 'Organization' },
      );
      const pseudo = await hydrate('contact', { id: '', ...placed } as HydratedRecord);
      expect(pseudo.id).toBe('');
      expect(check(permix, rebacSchema, 'contact', pseudo, 'create')).toBe(false);
      expect(check(permix, rebacSchema, 'contact', { ...pseudo, id: contact.id }, 'create')).toBe(
        true,
      );
    });
  });
});

describe("placeUnder places a child under its owner along the owner's relation", () => {
  const under = (child: string, owner: string, record: Record<string, unknown>, kind?: string) =>
    placeUnder(
      schemaMap,
      `db:${child}`,
      owner,
      `db:${owner}`,
      record,
      kind ? { field: 'ownerModel', operator: 'equals', value: kind } : undefined,
    );

  it('a polymorphic child carries the pinned kind and the owner keys', () => {
    const space = { id: 's1', organizationId: 'o1' };
    expect(under('integration', 'space', space, 'Space')).toEqual([
      { ownerModel: 'Space', organizationId: 'o1', spaceId: 's1', space },
    ]);
    const user = { id: 'u1' };
    expect(under('contact', 'user', user, 'User')).toEqual([
      { ownerModel: 'User', userId: 'u1', user },
    ]);
    const member = { id: 'm1', organizationId: 'o1', userId: 'u1' };
    expect(under('token', 'organizationUser', member, 'OrganizationUser')).toEqual([
      {
        ownerModel: 'OrganizationUser',
        organizationId: 'o1',
        userId: 'u1',
        organizationUser: member,
      },
    ]);
  });

  it('a plain child carries the single relation to its owner', () => {
    const organization = { id: 'o1' };
    expect(under('authProvider', 'organization', organization)).toEqual([
      { organizationId: 'o1', organization },
    ]);
  });

  it('an owner the child cannot have places nothing', () => {
    expect(under('flow', 'organization', { id: 'o1' })).toEqual([]);
    expect(under('contact', 'integration', { id: 'i1' })).toEqual([]);
  });
});

describe('validateSubmodelPermission on a route with no submodel is a configuration error', () => {
  it('throws on the request', async () => {
    const route = readRoute({ model: Modules.organization, responseSchema: z.object({}) });
    const context = {
      get: (key: string) => (key === 'routeConfig' ? route : undefined),
    } as unknown as Parameters<ReturnType<typeof validateSubmodelPermission>>[0];
    await expect(validateSubmodelPermission('read')(context, async () => {})).rejects.toThrow(
      'validateSubmodelPermission needs a route with a model submodel',
    );
  });
});

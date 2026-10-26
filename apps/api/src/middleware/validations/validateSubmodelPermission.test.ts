import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { z } from '@hono/zod-openapi';
import { db, hydrate, ownerRef, unregisterDbHook } from '@template/db';
import type { Organization, Role, Space, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createContact,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
  createUser,
} from '@template/db/test';
import { createPermissions } from '@template/permissions/client';
import { check, rebacSchema } from '@template/permissions/rebac';
import { app } from '#/app';
import { registerClearCacheHook } from '#/hooks/cache/hook';
import { readRoute } from '#/lib/routeTemplates';
import { AUTH_PROBE_HEADER, AUTH_PROBE_SECRET } from '#/lib/utils/authProbe';
import { validateSubmodelPermission } from '#/middleware/validations/validateSubmodelPermission';
import { Modules } from '#/modules/modules';
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

const userToken = async (user: User, role: Role): Promise<Headers> => {
  const rawKey = randomBytes(24).toString('hex');
  await createToken(
    {
      ownerModel: 'User',
      role,
      keyHash: createHash('sha256').update(rawKey).digest('hex'),
      keyPrefix: rawKey.slice(0, 16),
    },
    { user },
  );
  return { authorization: `Bearer ${rawKey}` };
};

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
  let outsider: Headers;

  const orgRoles = ['owner', 'admin', 'member', 'viewer'] as const;

  beforeAll(async () => {
    ({ entity: organization } = await createOrganization());
    ({ entity: space } = await createSpace({}, { organization }));
    for (const role of orgRoles) {
      const { context } = await createOrganizationUser({ role }, { organization });
      org[role] = await jwt(context.user);
    }
    for (const role of orgRoles) {
      const { context } = await createOrganizationUser({ role: 'member' }, { organization });
      await createSpaceUser({ role }, { ...context, space });
      spc[role] = await jwt(context.user);
    }
    const { context } = await createOrganizationUser({ role: 'owner' });
    outsider = await jwt(context.user);
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

  describe('organization children', () => {
    const at = (path: string) => `/organization/${organization.id}${path}`;
    const callers = () => ({ ...org, outsider });

    it('contacts: managers create, every member lists', async () => {
      expect(await statuses(callers(), 'POST', at('/contacts'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'denied',
        viewer: 'denied',
        outsider: 'denied',
      });
      expect(await statuses(callers(), 'GET', at('/contacts'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'passes',
        viewer: 'passes',
        outsider: 'denied',
      });
    });

    it('integrations: managers create, every member lists', async () => {
      expect(await statuses(callers(), 'POST', at('/integrations'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'denied',
        viewer: 'denied',
        outsider: 'denied',
      });
      expect(await statuses(callers(), 'GET', at('/integrations'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'passes',
        viewer: 'passes',
        outsider: 'denied',
      });
    });

    it('webhook subscriptions: operators create, every member lists', async () => {
      expect(await statuses(callers(), 'POST', at('/webhookSubscriptions'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'passes',
        viewer: 'denied',
        outsider: 'denied',
      });
      expect(await statuses(callers(), 'GET', at('/webhookSubscriptions'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'passes',
        viewer: 'passes',
        outsider: 'denied',
      });
    });

    it('auth providers: only owners create', async () => {
      expect(await statuses(callers(), 'POST', at('/authProviders'))).toEqual({
        owner: 'passes',
        admin: 'denied',
        member: 'denied',
        viewer: 'denied',
        outsider: 'denied',
      });
    });

    it('tokens: only owners list (R38: token list read = own at the owner)', async () => {
      expect(await statuses(callers(), 'GET', at('/tokens'))).toEqual({
        owner: 'passes',
        admin: 'denied',
        member: 'denied',
        viewer: 'denied',
        outsider: 'denied',
      });
    });
  });

  describe('space children', () => {
    const at = (path: string) => `/space/${space.id}${path}`;
    let orgOwnerNoSeat: Headers;
    let orgAdminNoSeat: Headers;

    beforeAll(() => {
      orgOwnerNoSeat = org.owner;
      orgAdminNoSeat = org.admin;
    });

    const callers = () => ({ ...spc, orgOwnerNoSeat, orgAdminNoSeat, outsider });

    it('contacts: space managers and org owners create; space members list', async () => {
      expect(await statuses(callers(), 'POST', at('/contacts'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'denied',
        viewer: 'denied',
        orgOwnerNoSeat: 'passes',
        orgAdminNoSeat: 'denied',
        outsider: 'denied',
      });
      expect(await statuses(callers(), 'GET', at('/contacts'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'passes',
        viewer: 'passes',
        orgOwnerNoSeat: 'passes',
        orgAdminNoSeat: 'denied',
        outsider: 'denied',
      });
    });

    it('integrations: space managers and org owners create; space members list', async () => {
      expect(await statuses(callers(), 'POST', at('/integrations'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'denied',
        viewer: 'denied',
        orgOwnerNoSeat: 'passes',
        orgAdminNoSeat: 'denied',
        outsider: 'denied',
      });
      expect(await statuses(callers(), 'GET', at('/integrations'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'passes',
        viewer: 'passes',
        orgOwnerNoSeat: 'passes',
        orgAdminNoSeat: 'denied',
        outsider: 'denied',
      });
    });

    it('webhook subscriptions: space operators create; space members list', async () => {
      expect(await statuses(callers(), 'POST', at('/webhookSubscriptions'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'passes',
        viewer: 'denied',
        orgOwnerNoSeat: 'passes',
        orgAdminNoSeat: 'denied',
        outsider: 'denied',
      });
      expect(await statuses(callers(), 'GET', at('/webhookSubscriptions'))).toEqual({
        owner: 'passes',
        admin: 'passes',
        member: 'passes',
        viewer: 'passes',
        orgOwnerNoSeat: 'passes',
        orgAdminNoSeat: 'denied',
        outsider: 'denied',
      });
    });

    it('tokens: only space owners (and org owners) list', async () => {
      expect(await statuses(callers(), 'GET', at('/tokens'))).toEqual({
        owner: 'passes',
        admin: 'denied',
        member: 'denied',
        viewer: 'denied',
        orgOwnerNoSeat: 'passes',
        orgAdminNoSeat: 'denied',
        outsider: 'denied',
      });
    });
  });

  describe('my children (/me)', () => {
    let callers: Record<string, Headers>;

    beforeAll(async () => {
      const { entity: organizationUser } = await createOrganizationUser(
        { role: 'owner' },
        { organization },
      );
      const memberKey = randomBytes(24).toString('hex');
      await createToken(
        {
          ownerModel: 'OrganizationUser',
          role: 'owner',
          keyHash: createHash('sha256').update(memberKey).digest('hex'),
          keyPrefix: memberKey.slice(0, 16),
        },
        { organizationUser },
      );
      callers = {
        user: await jwt((await createUser()).entity),
        ownerToken: await userToken((await createUser()).entity, 'owner'),
        viewerToken: await userToken((await createUser()).entity, 'viewer'),
        memberToken: { authorization: `Bearer ${memberKey}` },
      };
    });

    it('creates need operate on me', async () => {
      for (const path of ['/contacts', '/flows', '/integrations', '/webhookSubscriptions'])
        expect([path, await statuses(callers, 'POST', `/me${path}`)]).toEqual([
          path,
          {
            user: 'passes',
            ownerToken: 'passes',
            viewerToken: 'denied',
            memberToken: 'unauthenticated',
          },
        ]);
    });

    it('lists need read on me', async () => {
      for (const path of ['/contacts', '/integrations', '/webhookSubscriptions'])
        expect([path, await statuses(callers, 'GET', `/me${path}`)]).toEqual([
          path,
          {
            user: 'passes',
            ownerToken: 'passes',
            viewerToken: 'passes',
            memberToken: 'unauthenticated',
          },
        ]);
    });

    it('my tokens: own on me', async () => {
      expect(await statuses(callers, 'GET', '/me/tokens')).toEqual({
        user: 'passes',
        ownerToken: 'passes',
        viewerToken: 'denied',
        memberToken: 'unauthenticated',
      });
    });
  });

  describe('attempts to get around it', () => {
    it("a body naming another owner changes nothing: the check is on the route's owner", async () => {
      const { entity: other } = await createOrganization();
      const response = await app.request(`/api/v1/organization/${organization.id}/contacts`, {
        method: 'POST',
        headers: { ...org.member, 'content-type': 'application/json' },
        body: JSON.stringify({ ownerModel: 'Organization', organizationId: other.id }),
      });
      expect(response.status).toBe(403);
    });

    it('a WS subscribe probe answers as the route does', async () => {
      const probe = async (headers: Headers) =>
        (
          await app.request(`/api/v1/organization/${organization.id}/contacts`, {
            headers: { ...headers, [AUTH_PROBE_HEADER]: AUTH_PROBE_SECRET },
          })
        ).status;
      expect(await probe(org.viewer)).toBe(204);
      expect(await probe(outsider)).toBe(403);
    });

    it("a member's stored actions at another organization open nothing here", async () => {
      const { entity: other } = await createOrganization();
      const { context } = await createOrganizationUser(
        {
          role: 'viewer',
          entitlements: { manage: true },
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
      const rawKey = randomBytes(24).toString('hex');
      await createToken(
        {
          ownerModel: 'User',
          role: 'viewer',
          entitlements: [
            {
              resource: 'db:contact',
              anchor: { resource: 'db:organization', id: other.id },
              actions: { create: true },
            },
          ],
          keyHash: createHash('sha256').update(rawKey).digest('hex'),
          keyPrefix: rawKey.slice(0, 16),
        },
        { user: context.user },
      );
      const headers = { authorization: `Bearer ${rawKey}` };
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
      const pseudo = await hydrate('contact', ownerRef('contact', 'organization', organization));
      expect(pseudo.id).toBe('');
      expect(check(permix, rebacSchema, 'contact', pseudo, 'create')).toBe(false);
      expect(check(permix, rebacSchema, 'contact', { ...pseudo, id: contact.id }, 'create')).toBe(
        true,
      );
    });
  });
});

describe('ownerRef places a pseudo record of the child under its owner', () => {
  it('a polymorphic child carries the discriminator and the owner keys', () => {
    const space = { id: 's1', organizationId: 'o1' };
    expect(ownerRef('integration', 'space', space)).toEqual({
      id: '',
      ownerModel: 'Space',
      organizationId: 'o1',
      spaceId: 's1',
    });
    expect(ownerRef('contact', 'user', { id: 'u1' })).toEqual({
      id: '',
      ownerModel: 'User',
      userId: 'u1',
    });
    expect(
      ownerRef('token', 'organizationUser', { id: 'm1', organizationId: 'o1', userId: 'u1' }),
    ).toEqual({ id: '', ownerModel: 'OrganizationUser', organizationId: 'o1', userId: 'u1' });
  });

  it('a plain child carries the single relation to its owner', () => {
    expect(ownerRef('authProvider', 'organization', { id: 'o1' })).toEqual({
      id: '',
      organizationId: 'o1',
    });
  });

  it('an owner the child cannot have is an error', () => {
    expect(() => ownerRef('flow', 'organization', { id: 'o1' })).toThrow();
    expect(() => ownerRef('contact', 'integration', { id: 'i1' })).toThrow();
  });
});

describe('validateSubmodelPermission on a route with no submodel is a configuration error', () => {
  it('throws when the route is built', () => {
    expect(() =>
      readRoute({
        model: Modules.organization,
        responseSchema: z.object({}),
        middleware: [validateSubmodelPermission('read')],
      }),
    ).toThrow('validateSubmodelPermission needs a route with a submodel');
  });
});

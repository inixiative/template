import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type {
  Inquiry,
  Integration,
  Organization,
  OrganizationUser,
  Token,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createIntegration,
  createIntegrationResource,
  createOrganization,
  createOrganizationUser,
  createToken,
} from '@template/db/test';
import { inquiryRouter } from '#/modules/inquiry';
import { integrationRouter } from '#/modules/integration';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';
import { parseSuccessBody, post } from '#tests/utils/request';

let organization: Organization;
let integration: Integration;
let token: Token;
let requester: { user: User; member: OrganizationUser };
let admin: { user: User; member: OrganizationUser };

const seat = async (role: 'admin' | 'member') => {
  const { entity: member, context } = await createOrganizationUser({ role }, { organization });
  return { user: context.user, member };
};

const appOf = ({ user, member }: { user: User; member: OrganizationUser }) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: [member],
    mount: [
      (hono) => hono.route('/api/v1/inquiry', inquiryRouter),
      (hono) => hono.route('/api/v1/me', meRouter),
    ],
  });

const onChannel = (source: Record<string, string>) => ({
  resource: 'IntegrationResource',
  actions: ['read'],
  sourceModel: 'IntegrationResource',
  source: { integrationId: integration.id, kind: 'channel', externalId: 'C0123', ...source },
});

const ask = (add: unknown[]) =>
  appOf(requester).fetch(
    post('/api/v1/me/inquiries', {
      type: 'changeEntitlements',
      status: 'sent',
      targetModel: 'Token',
      targetTokenId: token.id,
      content: { add },
    }),
  );

const answer = (inquiry: Inquiry, status: 'approved' | 'denied', add: unknown[] = []) =>
  appOf(admin).fetch(
    post(`/api/v1/inquiry/${inquiry.id}/resolve`, {
      expectedUpdatedAt: new Date(inquiry.updatedAt).toISOString(),
      status,
      ...(add.length ? { add } : {}),
    }),
  );

const channels = () =>
  db.withDeleted(() =>
    db.integrationResource.findMany({ where: { integrationId: integration.id } }),
  );

const anchorsOfToken = async () =>
  (await db.entitlement.findMany({ where: { targetTokenId: token.id } })).map(
    ({ sourceModel, sourceId }) => ({ sourceModel, sourceId }),
  );

beforeEach(async () => {
  ({ entity: organization } = await createOrganization());
  ({ entity: integration } = await createIntegration({
    ownerModel: 'Organization',
    organizationId: organization.id,
    provider: 'slack',
  }));
  ({ entity: token } = await createToken({
    ownerModel: 'Organization',
    organizationId: organization.id,
    role: 'viewer',
  }));
  requester = await seat('admin');
  admin = await seat('admin');
});

afterEach(async () => {
  await cleanupTouchedTables(db);
});

describe('asking for access names an integration resource by its external id (Aron, 2026-11-23)', () => {
  it('asking creates nothing; approving registers the channel tracked and anchors the grant at it', async () => {
    const asked = await ask([onChannel({})]);
    expect(asked.status).toBe(201);
    expect(await channels()).toEqual([]);

    const inquiry = (await parseSuccessBody<Inquiry>(asked)).data;
    expect((await answer(inquiry, 'approved', [onChannel({})])).status).toBe(200);

    const [channel] = await channels();
    expect(channel).toMatchObject({
      kind: 'channel',
      externalId: 'C0123',
      status: 'tracked',
      deletedAt: null,
    });
    expect(await anchorsOfToken()).toEqual([
      { sourceModel: 'IntegrationResource', sourceId: channel!.id },
    ]);
  });

  it('a registered channel is the one the grant anchors at, and approving leaves it as it was', async () => {
    const { entity: channel } = await createIntegrationResource(
      { kind: 'channel', externalId: 'C0123', name: 'General' },
      { integration },
    );
    const inquiry = (await parseSuccessBody<Inquiry>(await ask([onChannel({})]))).data;
    expect((await answer(inquiry, 'approved', [onChannel({})])).status).toBe(200);

    expect(await channels()).toMatchObject([{ id: channel.id, name: 'General' }]);
    expect(await anchorsOfToken()).toEqual([
      { sourceModel: 'IntegrationResource', sourceId: channel.id },
    ]);
  });

  it('a denial leaves no resource behind', async () => {
    const inquiry = (await parseSuccessBody<Inquiry>(await ask([onChannel({})]))).data;
    expect((await answer(inquiry, 'denied')).status).toBe(200);
    expect(await channels()).toEqual([]);
  });

  it('a kind the provider does not have, or an identifier that is not one, is refused when asked', async () => {
    expect((await ask([onChannel({ kind: 'repository' })])).status).toBe(400);
    expect((await ask([onChannel({ externalId: '../x' })])).status).toBe(400);
    expect((await ask([onChannel({ integrationId: Bun.randomUUIDv7() })])).status).toBe(422);
    expect(await db.inquiry.count({ where: { targetTokenId: token.id } })).toBe(0);
  });
});

describe('what asking may name, and what approving records (review, 2026-11-23)', () => {
  it("a key is checked only on an integration the asker can read, so another's integration tells nothing", async () => {
    const { entity: elsewhere } = await createOrganization();
    const { entity: theirs } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: elsewhere.id,
      provider: 'github',
    });
    const response = await ask([onChannel({ integrationId: theirs.id })]);
    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).not.toContain('github');
  });

  it('a kind that is a property of every object is still not a kind the provider has', async () => {
    expect((await ask([onChannel({ kind: 'constructor' })])).status).toBe(400);
    expect((await ask([onChannel({ kind: '__proto__' })])).status).toBe(400);
  });

  it('approving access to an untracked channel tracks it', async () => {
    const { entity: channel } = await createIntegrationResource(
      { kind: 'channel', externalId: 'C0123', status: 'untracked' },
      { integration },
    );
    const inquiry = (await parseSuccessBody<Inquiry>(await ask([onChannel({})]))).data;
    expect((await answer(inquiry, 'approved', [onChannel({})])).status).toBe(200);
    expect(await channels()).toMatchObject([{ id: channel.id, status: 'tracked' }]);
  });

  it('the approved record names the resource the grant anchors at', async () => {
    const inquiry = (await parseSuccessBody<Inquiry>(await ask([onChannel({})]))).data;
    await answer(inquiry, 'approved', [onChannel({})]);
    const [channel] = await channels();
    const approved = await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(approved.resolution).toMatchObject({
      add: [{ sourceModel: 'IntegrationResource', sourceId: channel!.id }],
    });
  });

  it('an approval the writer refuses registers nothing and stays open', async () => {
    const inquiry = (await parseSuccessBody<Inquiry>(await ask([onChannel({})]))).data;
    const response = await answer(inquiry, 'approved', [{ ...onChannel({}), actions: ['own'] }]);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await channels()).toEqual([]);
    expect((await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).status).toBe('sent');
  });
});

describe('registering checks the key against what the provider has', () => {
  it('a github repository id is numeric', async () => {
    const { entity: github } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      provider: 'github',
    });
    const register = (externalId: string) =>
      createTestApp({
        mockUser: admin.user,
        mockOrganizationUsers: [admin.member],
        mount: [(hono) => hono.route('/api/v1/integration', integrationRouter)],
      }).fetch(
        post(`/api/v1/integration/${github.id}/integrationResources`, {
          name: 'Repo',
          kind: 'repository',
          externalId,
        }),
      );
    expect((await register('owner/name')).status).toBe(400);
    expect((await register('123456')).status).toBe(201);
  });
});

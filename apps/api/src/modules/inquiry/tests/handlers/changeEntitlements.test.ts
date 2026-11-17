import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type {
  Inquiry,
  Organization,
  OrganizationUser,
  Token,
  User,
} from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createInquiry,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import { inquiryRouter } from '#/modules/inquiry';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';
import { type Entry, entry } from '#tests/utils/entitlementEntry';
import { json, post } from '#tests/utils/request';

let organization: Organization;
let token: Token;
let requester: { user: User; member: OrganizationUser };
let admin: { user: User; member: OrganizationUser };

const seat = async (role: 'admin' | 'member') => {
  const { entity: member, context } = await createOrganizationUser({ role }, { organization });
  return { user: context.user, member };
};

const appOf = (user: User, member?: OrganizationUser) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: member ? [member] : [],
    mount: [
      (hono) => hono.route('/api/v1/inquiry', inquiryRouter),
      (hono) => hono.route('/api/v1/me', meRouter),
    ],
  });

const onOrganization = (actions: string[]): Entry =>
  entry('db:organization', ['db:organization', organization.id], actions);

const asked = async (add: Entry[], remove: string[] = []) =>
  (
    await createInquiry({
      type: 'changeEntitlements',
      status: 'sent',
      sourceModel: 'User',
      sourceUserId: requester.user.id,
      targetModel: 'Token',
      targetTokenId: token.id,
      content: { add, remove },
    })
  ).entity;

const answer = (
  by: { user: User; member?: OrganizationUser },
  inquiry: Inquiry,
  body: Record<string, unknown>,
  status = 'approved',
) =>
  appOf(by.user, by.member).fetch(
    post(`/api/v1/inquiry/${inquiry.id}/resolve`, {
      expectedUpdatedAt: new Date(inquiry.updatedAt).toISOString(),
      status,
      ...body,
    }),
  );

const held = async () =>
  (await db.entitlement.findMany({ where: { targetModel: 'Token', targetTokenId: token.id } })).map(
    ({ resource, actions }) => ({ resource, actions }),
  );

beforeEach(async () => {
  ({ entity: organization } = await createOrganization());
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

const ask = (by: { user: User; member?: OrganizationUser }, target: Record<string, unknown>) =>
  appOf(by.user, by.member).fetch(
    post('/api/v1/me/inquiries', {
      type: 'changeEntitlements',
      status: 'sent',
      content: { add: [onOrganization(['read'])] },
      ...target,
    }),
  );

const statusOf = async (inquiry: Inquiry) =>
  (await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).status;

describe('changeEntitlements: a request addressed to the record whose entitlements change (Aron, 2026-11-16)', () => {
  it('someone who can read the token asks from their own inbox; it carries the token and its organization; one open request per asker and record', async () => {
    const target = { targetModel: 'Token', targetTokenId: token.id };
    const response = await ask(requester, target);
    expect(response.status).toBe(201);
    expect((await json<Inquiry>(response)).data).toMatchObject({
      status: 'sent',
      sourceUserId: requester.user.id,
      targetTokenId: token.id,
      targetOrganizationId: organization.id,
    });
    expect((await ask(requester, target)).status).toBe(409);
  });

  it('a request carries positive rules only: a negated where is refused when asked, as on the direct route', async () => {
    const negated = {
      ...onOrganization(['read']),
      where: { field: 'name', operator: 'notEquals', value: 'x' },
    };
    const response = await ask(requester, {
      targetModel: 'Token',
      targetTokenId: token.id,
      content: { add: [negated] },
    });
    expect(response.status).toBe(422);
    expect(JSON.stringify(await response.json())).toContain('add.0.where');
    expect(await db.inquiry.count({ where: { targetTokenId: token.id } })).toBe(0);
  });

  it('a stranger cannot address a record they cannot read, and is shown nothing of it', async () => {
    const { entity: stranger } = await createUser();
    const response = await ask(
      { user: stranger },
      { targetModel: 'Token', targetTokenId: token.id },
    );
    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain(organization.id);
    expect(await db.inquiry.count({ where: { targetTokenId: token.id } })).toBe(0);
  });

  it('an approval writes the copy the approver sends back, through the entitlement writer', async () => {
    const inquiry = await asked([onOrganization(['read']), onOrganization(['operate'])]);
    const response = await answer(admin, inquiry, { add: [onOrganization(['read'])] });
    expect(response.status).toBe(200);
    expect(await held()).toEqual([{ resource: 'Organization', actions: ['read'] }]);
    expect(await statusOf(inquiry)).toBe('approved');
  });

  it('an approval that only removes takes the row away; a row of another holder is a 404 and it stays open', async () => {
    await answer(admin, await asked([onOrganization(['read'])]), {
      add: [onOrganization(['read'])],
    });
    const [row] = await db.entitlement.findMany({ where: { targetTokenId: token.id } });
    const { entity: other } = await createToken({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: 'viewer',
      entitlements: [onOrganization(['read'])],
    });
    const [othersRow] = await db.entitlement.findMany({ where: { targetTokenId: other.id } });

    const foreign = await asked([], [othersRow!.id]);
    expect((await answer(admin, foreign, { remove: [othersRow!.id] })).status).toBe(404);
    expect(await statusOf(foreign)).toBe('sent');
    await answer(admin, foreign, {}, 'denied');

    const inquiry = await asked([], [row!.id]);
    expect((await answer(admin, inquiry, { remove: [row!.id] })).status).toBe(200);
    expect(await held()).toEqual([]);
  });

  it('an approver who could not grant it directly is refused, and the inquiry stays open with nothing written', async () => {
    const inquiry = await asked([onOrganization(['own'])]);
    const response = await answer(admin, inquiry, { add: [onOrganization(['own'])] });
    expect(response.status).toBe(403);
    expect(await held()).toEqual([]);
    expect(await statusOf(inquiry)).toBe('sent');
  });

  it('an approval with nothing in it is refused; a denial needs nothing in it', async () => {
    const inquiry = await asked([onOrganization(['read'])]);
    expect((await answer(admin, inquiry, {})).status).toBe(422);
    expect(await statusOf(inquiry)).toBe('sent');
    expect((await answer(admin, inquiry, { explanation: 'not now' }, 'denied')).status).toBe(200);
    expect(await statusOf(inquiry)).toBe('denied');
    expect(await held()).toEqual([]);
  });

  it('a member who does not administer the token cannot answer', async () => {
    const inquiry = await asked([onOrganization(['read'])]);
    const body = { add: [onOrganization(['read'])] };
    expect((await answer(await seat('member'), inquiry, body)).status).toBe(403);
    expect(await held()).toEqual([]);
  });

  it("an integration is addressed the same way: its organization's admin answers, a member does not", async () => {
    const { entity: integration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: 'viewer',
    });
    const response = await ask(requester, {
      targetModel: 'Integration',
      targetIntegrationId: integration.id,
    });
    expect(response.status).toBe(201);
    const { data: inquiry } = await json<Inquiry>(response);
    expect(inquiry).toMatchObject({ targetOrganizationId: organization.id });
    const body = { add: [onOrganization(['read'])] };
    expect((await answer(await seat('member'), inquiry, body)).status).toBe(403);
    expect((await answer(admin, inquiry, body)).status).toBe(200);
    expect(
      await db.entitlement.count({
        where: { targetIntegrationId: integration.id, deletedAt: null },
      }),
    ).toBe(1);
  });
});

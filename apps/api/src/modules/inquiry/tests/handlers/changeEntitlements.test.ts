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
let requester: User;
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

const asked = async (add: Entry[]) =>
  (
    await createInquiry({
      type: 'changeEntitlements',
      status: 'sent',
      sourceModel: 'User',
      sourceUserId: requester.id,
      targetModel: 'Token',
      targetTokenId: token.id,
      content: { add, remove: [] },
    })
  ).entity;

const answer = (
  by: { user: User; member?: OrganizationUser },
  inquiry: Inquiry,
  body: Record<string, unknown>,
) =>
  appOf(by.user, by.member).fetch(
    post(`/api/v1/inquiry/${inquiry.id}/resolve`, {
      expectedUpdatedAt: new Date(inquiry.updatedAt).toISOString(),
      status: 'approved',
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
  ({ entity: requester } = await createUser());
  admin = await seat('admin');
});

afterEach(async () => {
  await cleanupTouchedTables(db);
});

describe('changeEntitlements: a request addressed to the record whose entitlements change (Aron, 2026-11-16)', () => {
  it('anyone asks from their own inbox, naming the token; it carries the token and its organization', async () => {
    const response = await appOf(requester).fetch(
      post('/api/v1/me/inquiries', {
        type: 'changeEntitlements',
        status: 'sent',
        targetModel: 'Token',
        targetTokenId: token.id,
        content: { add: [onOrganization(['read'])] },
      }),
    );
    expect(response.status).toBe(201);
    expect((await json<Inquiry>(response)).data).toMatchObject({
      status: 'sent',
      sourceUserId: requester.id,
      targetTokenId: token.id,
      targetOrganizationId: organization.id,
    });
  });

  it('an approval writes the copy the approver sends back, through the entitlement writer', async () => {
    const inquiry = await asked([onOrganization(['read']), onOrganization(['operate'])]);
    const response = await answer(admin, inquiry, { add: [onOrganization(['read'])] });
    expect(response.status).toBe(200);
    expect(await held()).toEqual([{ resource: 'Organization', actions: ['read'] }]);
    expect((await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).status).toBe(
      'approved',
    );
  });

  it('an approver who could not grant it directly is refused, and the inquiry stays open with nothing written', async () => {
    const inquiry = await asked([onOrganization(['own'])]);
    const response = await answer(admin, inquiry, { add: [onOrganization(['own'])] });
    expect(response.status).toBe(403);
    expect(await held()).toEqual([]);
    expect((await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).status).toBe('sent');
  });

  it('an approval with nothing in it is refused: to give nothing, deny', async () => {
    const inquiry = await asked([onOrganization(['read'])]);
    expect((await answer(admin, inquiry, {})).status).toBe(422);
    expect((await db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).status).toBe('sent');
  });

  it('a member who does not administer the token cannot answer; the person who asked cannot either', async () => {
    const inquiry = await asked([onOrganization(['read'])]);
    const body = { add: [onOrganization(['read'])] };
    expect((await answer(await seat('member'), inquiry, body)).status).toBe(403);
    expect((await answer({ user: requester }, inquiry, body)).status).not.toBe(200);
    expect(await held()).toEqual([]);
  });
});

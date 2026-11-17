import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import type { Inquiry, Organization, Token, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createInquiry,
  createIntegration,
  createOrganization,
  createToken,
  createUser,
} from '@template/db/test';
import { type Entry, entry } from '#tests/utils/entitlementEntry';

let organization: Organization;
let token: Token;
let requester: User;

const onOrganization = (actions: string[]): Entry =>
  entry('db:organization', ['db:organization', organization.id], actions);

const rowsOf = async () =>
  (await db.entitlement.findMany({ where: { targetTokenId: token.id } })).map(({ id }) => id);

const request = async (
  content: { add: Entry[]; remove: string[] },
  status: 'sent' | 'approved' = 'sent',
) =>
  (
    await createInquiry({
      type: 'changeEntitlements',
      status,
      sourceModel: 'User',
      sourceUserId: requester.id,
      targetModel: 'Token',
      targetTokenId: token.id,
      content,
    })
  ).entity;

const stored = (inquiry: Inquiry) =>
  db.withDeleted(() => db.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } }));

const removeRows = (ids: string[]) =>
  db.entitlement.updateManyAndReturn({
    where: { id: { in: ids } },
    data: { deletedAt: new Date() },
  });

beforeEach(async () => {
  ({ entity: organization } = await createOrganization());
  ({ entity: requester } = await createUser());
  ({ entity: token } = await createToken({
    ownerModel: 'Organization',
    organizationId: organization.id,
    role: 'viewer',
    entitlements: [onOrganization(['read']), onOrganization(['operate'])],
  }));
});

afterEach(async () => {
  await cleanupTouchedTables(db);
});

describe('a removed row leaves the open requests that would remove it (Aron, 2026-11-16)', () => {
  it('it drops out of remove, as an audited update, and the request stays open with the rest', async () => {
    const [read, operate] = await rowsOf();
    const inquiry = await request({ add: [onOrganization(['manage'])], remove: [read!, operate!] });
    await removeRows([read!]);
    const after = await stored(inquiry);
    expect(after).toMatchObject({ status: 'sent', deletedAt: null });
    expect((after.content as { remove: string[] }).remove).toEqual([operate]);
    expect(
      await db.auditLog.count({ where: { subjectInquiryId: inquiry.id, action: 'update' } }),
    ).toBe(1);
  });

  it('a request left asking for nothing is canceled', async () => {
    const [read] = await rowsOf();
    const inquiry = await request({ add: [], remove: [read!] });
    await removeRows([read!]);
    expect(await stored(inquiry)).toMatchObject({ status: 'canceled', expiresAt: null });
    expect((await stored(inquiry)).deletedAt).not.toBeNull();
  });

  it('a closed request is the record of what was asked and is left as it is', async () => {
    const [read] = await rowsOf();
    const inquiry = await request({ add: [], remove: [read!] }, 'approved');
    await removeRows([read!]);
    expect(await stored(inquiry)).toMatchObject({
      status: 'approved',
      deletedAt: null,
      content: { add: [], remove: [read] },
    });
  });
});

describe('an open inquiry whose party is deleted is canceled; a closed one stays (Aron, 2026-11-16)', () => {
  it('deleting the token cancels the open request to it and keeps the approved one', async () => {
    const open = await request({ add: [onOrganization(['manage'])], remove: [] });
    const decided = await request({ add: [onOrganization(['manage'])], remove: [] }, 'approved');
    await db.token.update({ where: { id: token.id }, data: { deletedAt: new Date() } });
    expect(await stored(open)).toMatchObject({ status: 'canceled', expiresAt: null });
    expect((await stored(open)).deletedAt).not.toBeNull();
    expect(await stored(decided)).toMatchObject({ status: 'approved', deletedAt: null });
  });

  it('deleting the person who asked cancels it too, from the source side', async () => {
    const open = await request({ add: [onOrganization(['manage'])], remove: [] });
    await db.user.update({ where: { id: requester.id }, data: { deletedAt: new Date() } });
    expect(await stored(open)).toMatchObject({ status: 'canceled' });
  });

  it('a canceled inquiry stays canceled when its party is revived', async () => {
    const { entity: integration } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: organization.id,
      role: 'viewer',
    });
    const { entity: open } = await createInquiry({
      type: 'changeEntitlements',
      status: 'sent',
      sourceModel: 'User',
      sourceUserId: requester.id,
      targetModel: 'Integration',
      targetIntegrationId: integration.id,
      content: { add: [onOrganization(['read'])], remove: [] },
    });
    await db.integration.update({ where: { id: integration.id }, data: { deletedAt: new Date() } });
    await db.withDeleted(() =>
      db.integration.update({ where: { id: integration.id }, data: { deletedAt: null } }),
    );
    expect(await stored(open)).toMatchObject({ status: 'canceled' });
    expect((await stored(open)).deletedAt).not.toBeNull();
  });
});

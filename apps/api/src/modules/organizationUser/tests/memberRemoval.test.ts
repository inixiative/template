import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { db, unregisterDbHook } from '@template/db';
import type { Organization, OrganizationUser, User } from '@template/db/generated/client/client';
import {
  InquiryResourceModel,
  InquiryStatus,
  InquiryType,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createInquiry,
  createIntegration,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createToken,
} from '@template/db/test';
import { registerSoftDeleteCascadeHook } from '#/hooks/softDeleteCascade/hook';
import { inquiryRouter } from '#/modules/inquiry';
import { organizationUserRouter } from '#/modules/organizationUser';
import { spaceUserRouter } from '#/modules/spaceUser';
import { createTestApp } from '#tests/createTestApp';
import { del, post } from '#tests/utils/request';

let organization: Organization;
let owner: { user: User; seat: OrganizationUser };

const asOwner = () =>
  createTestApp({
    mockUser: owner.user,
    mockOrganizationUsers: [owner.seat],
    mount: [
      (app) => app.route('/api/v1/organizationUser', organizationUserRouter),
      (app) => app.route('/api/v1/spaceUser', spaceUserRouter),
    ],
  }).fetch;

const rowOf = (id: string) =>
  db.organizationUser.findFirst({ where: { id, deletedAt: { not: null } } });

beforeAll(async () => {
  registerSoftDeleteCascadeHook();
  const { entity: seat, context } = await createOrganizationUser({ role: 'owner' });
  organization = context.organization;
  owner = { user: context.user, seat };
});

afterAll(async () => {
  unregisterDbHook('softDeleteCascade');
  await cleanupTouchedTables(db);
});

describe('removing a member tombstones the row, and what it held goes with it', () => {
  it('the member row is tombstoned, its integrations tombstoned with it, its tokens deleted', async () => {
    const { entity: seat } = await createOrganizationUser({ role: 'member' }, { organization });
    const { entity: integration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: seat.userId,
      role: 'viewer',
    });
    const { entity: token } = await createToken(
      { ownerModel: 'OrganizationUser', role: 'member' },
      { organizationUser: seat },
    );

    expect((await asOwner()(del(`/api/v1/organizationUser/${seat.id}`))).status).toBe(204);

    const tombstoned = await rowOf(seat.id);
    expect(tombstoned?.deletedAt).toBeInstanceOf(Date);
    const gone = await db.integration.findFirst({
      where: { id: integration.id, deletedAt: { not: null } },
    });
    expect(gone?.deletedAt?.getTime()).toBe(tombstoned!.deletedAt!.getTime());
    expect(await db.token.findFirst({ where: { id: token.id } })).toBeNull();
  });

  it('removing a space member tombstones the space member row', async () => {
    const { entity: space } = await createSpace({}, { organization });
    const { entity: seat, context } = await createOrganizationUser(
      { role: 'member' },
      { organization },
    );
    const { entity: spaceSeat } = await createSpaceUser(
      { role: 'member' },
      { ...context, organizationUser: seat, space },
    );

    expect((await asOwner()(del(`/api/v1/spaceUser/${spaceSeat.id}`))).status).toBe(204);

    const tombstoned = await db.spaceUser.findFirst({
      where: { id: spaceSeat.id, deletedAt: { not: null } },
    });
    expect(tombstoned?.deletedAt).toBeInstanceOf(Date);
  });
});

describe('inviting a removed member back revives their row', () => {
  it('the same row comes back live with the role of the new invite, and its integrations with it', async () => {
    const { entity: seat, context } = await createOrganizationUser(
      { role: 'admin' },
      { organization },
    );
    const { entity: integration } = await createIntegration({
      ownerModel: 'OrganizationUser',
      organizationId: organization.id,
      userId: seat.userId,
      role: 'viewer',
    });
    expect((await asOwner()(del(`/api/v1/organizationUser/${seat.id}`))).status).toBe(204);

    const { entity: inquiry } = await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status: InquiryStatus.sent,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: organization.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: context.user.id,
      content: { organizationId: organization.id, role: 'member' },
    });
    const response = await createTestApp({
      mockUser: context.user,
      mount: [(app) => app.route('/api/v1/inquiry', inquiryRouter)],
    }).fetch(
      post(`/api/v1/inquiry/${inquiry.id}/resolve`, {
        expectedUpdatedAt: new Date(inquiry.updatedAt).toISOString(),
        status: 'approved',
      }),
    );
    expect(response.status).toBe(200);

    const live = await db.organizationUser.findMany({
      where: { organizationId: organization.id, userId: context.user.id },
    });
    expect(live.map(({ id, role }) => ({ id, role }))).toEqual([{ id: seat.id, role: 'member' }]);
    expect(
      (await db.integration.findUnique({ where: { id: integration.id } }))?.deletedAt,
    ).toBeNull();
  });
});

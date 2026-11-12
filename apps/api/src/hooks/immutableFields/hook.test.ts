import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createInquiry, createOrganizationUser } from '@template/db/test';
import {
  clearImmutableFieldsCache,
  setImmutableFieldsCache,
} from '#/hooks/immutableFields/registry';

afterEach(async () => {
  await cleanupTouchedTables(db);
});

describe('immutableFields hook', () => {
  let userId: string;
  let orgId: string;
  let orgUserId: string;

  afterEach(() => {
    clearImmutableFieldsCache();
  });

  beforeEach(async () => {
    const { entity: orgUser } = await createOrganizationUser();
    userId = orgUser.userId;
    orgId = orgUser.organizationId;
    orgUserId = orgUser.id;
  });

  it('strips immutable FK fields from update', async () => {
    const result = await db.organizationUser.update({
      where: { id: orgUserId },
      data: {
        userId: 'should-strip',
        organizationId: 'should-strip',
        role: 'admin',
      },
    });

    expect(result.userId).toBe(userId);
    expect(result.organizationId).toBe(orgId);
    expect(result.role).toBe('admin');
  });

  it('strips immutable FK fields from updateManyAndReturn', async () => {
    await db.organizationUser.updateManyAndReturn({
      where: { id: orgUserId },
      data: {
        userId: 'should-strip',
        role: 'viewer',
      },
    });

    const result = await db.organizationUser.findUnique({ where: { id: orgUserId } });
    expect(result?.userId).toBe(userId);
    expect(result?.role).toBe('viewer');
  });

  it('strips immutable FK fields from upsert update path', async () => {
    const result = await db.organizationUser.upsert({
      where: { id: orgUserId },
      create: { userId, organizationId: orgId, role: 'member' },
      update: { userId: 'should-strip', organizationId: 'should-strip', role: 'member' },
    });

    expect(result.userId).toBe(userId);
    expect(result.organizationId).toBe(orgId);
    expect(result.role).toBe('member');
  });

  describe('overrides', () => {
    it('respects cache override - allows updating when field removed from cache', async () => {
      const { entity: testOrgUser } = await createOrganizationUser();
      const { entity: targetOrg } = await createOrganizationUser();

      setImmutableFieldsCache('OrganizationUser', ['userId']);

      const result = await db.organizationUser.update({
        where: { id: testOrgUser.id },
        data: { organizationId: targetOrg.organizationId },
      });

      expect(result.organizationId).toBe(targetOrg.organizationId);
    });

    it('respects cache override - strips additional fields added to cache', async () => {
      const { entity: testOrgUser } = await createOrganizationUser({ role: 'member' });

      setImmutableFieldsCache('OrganizationUser', ['userId', 'organizationId', 'role']);

      const result = await db.organizationUser.update({
        where: { id: testOrgUser.id },
        data: { role: 'owner' },
      });

      expect(result.role).toBe('member');
    });

    it('can lock nested JSON paths via cache', async () => {
      const { entity: inquiry } = await createInquiry({
        type: InquiryType.inviteOrganizationUser,
        sourceModel: InquiryResourceModel.Organization,
        sourceOrganizationId: orgId,
        targetModel: InquiryResourceModel.User,
        targetUserId: userId,
        content: { canInvite: true, maxProjects: 5 },
      });

      setImmutableFieldsCache('Inquiry', ['content.canInvite']);

      const result = await db.inquiry.update({
        where: { id: inquiry.id },
        data: { content: { canInvite: false, maxProjects: 100 } },
      });

      expect(result.content).toEqual({ maxProjects: 100 });
    });
  });
});

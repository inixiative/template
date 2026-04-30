import { afterAll, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { InquiryResourceModel, InquiryStatus, InquiryType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createInquiry, createOrganization, createUser } from '@template/db/test';
import { validateUniqueInquiry } from '#/modules/inquiry/validations/validateUniqueInquiry';

afterAll(async () => {
  await cleanupTouchedTables(db);
});

// inviteOrganizationUser is unique:'targeted' — uses (User source) → (User target).
// Use createSpace as the unique:'untargeted' representative — (Organization source).
// Both are template-side handlers; their types and source/target shapes are
// stable across schemas, which is the point of the registry-driven validate.

describe('validateUniqueInquiry', () => {
  describe('untargeted (sourceModel + source FK only)', () => {
    it('passes when no open inquiry exists for the source', async () => {
      const { entity: org } = await createOrganization();
      await expect(
        validateUniqueInquiry(
          db,
          {
            type: InquiryType.createSpace,
            sourceModel: InquiryResourceModel.Organization,
            sourceOrganizationId: org.id,
            sourceUserId: null,
            sourceSpaceId: null,
            targetModel: InquiryResourceModel.admin,
            targetUserId: null,
            targetOrganizationId: null,
            targetSpaceId: null,
          },
          'untargeted',
        ),
      ).resolves.toBeUndefined();
    });

    it('throws 409 when an open inquiry of the same type+source exists', async () => {
      const { entity: org, context: orgCtx } = await createOrganization();
      await createInquiry(
        {
          type: InquiryType.createSpace,
          status: InquiryStatus.sent,
          sourceModel: InquiryResourceModel.Organization,
          sourceOrganizationId: org.id,
          targetModel: InquiryResourceModel.admin,
        },
        orgCtx,
      );

      await expect(
        validateUniqueInquiry(
          db,
          {
            type: InquiryType.createSpace,
            sourceModel: InquiryResourceModel.Organization,
            sourceOrganizationId: org.id,
            sourceUserId: null,
            sourceSpaceId: null,
            targetModel: InquiryResourceModel.admin,
            targetUserId: null,
            targetOrganizationId: null,
            targetSpaceId: null,
          },
          'untargeted',
        ),
      ).rejects.toThrow(/already exists/);
    });

    it('passes when only a TERMINAL inquiry of the same type+source exists', async () => {
      const { entity: org, context: orgCtx } = await createOrganization();
      await createInquiry(
        {
          type: InquiryType.createSpace,
          status: InquiryStatus.approved,
          sourceModel: InquiryResourceModel.Organization,
          sourceOrganizationId: org.id,
          targetModel: InquiryResourceModel.admin,
        },
        orgCtx,
      );

      await expect(
        validateUniqueInquiry(
          db,
          {
            type: InquiryType.createSpace,
            sourceModel: InquiryResourceModel.Organization,
            sourceOrganizationId: org.id,
            sourceUserId: null,
            sourceSpaceId: null,
            targetModel: InquiryResourceModel.admin,
            targetUserId: null,
            targetOrganizationId: null,
            targetSpaceId: null,
          },
          'untargeted',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('targeted (sourceModel + source FK + targetModel + target FK)', () => {
    it('passes when no open inquiry matches both source and target', async () => {
      const { entity: source } = await createUser();
      const { entity: target } = await createUser();
      await expect(
        validateUniqueInquiry(
          db,
          {
            type: InquiryType.inviteOrganizationUser,
            sourceModel: InquiryResourceModel.User,
            sourceUserId: source.id,
            sourceOrganizationId: null,
            sourceSpaceId: null,
            targetModel: InquiryResourceModel.User,
            targetUserId: target.id,
            targetOrganizationId: null,
            targetSpaceId: null,
          },
          'targeted',
        ),
      ).resolves.toBeUndefined();
    });

    it('throws 409 when an open inquiry matches source AND target', async () => {
      const { entity: source, context: sourceCtx } = await createUser();
      const { entity: target } = await createUser();
      await createInquiry(
        {
          type: InquiryType.inviteOrganizationUser,
          status: InquiryStatus.sent,
          sourceModel: InquiryResourceModel.User,
          sourceUserId: source.id,
          targetModel: InquiryResourceModel.User,
          targetUserId: target.id,
        },
        sourceCtx,
      );

      await expect(
        validateUniqueInquiry(
          db,
          {
            type: InquiryType.inviteOrganizationUser,
            sourceModel: InquiryResourceModel.User,
            sourceUserId: source.id,
            sourceOrganizationId: null,
            sourceSpaceId: null,
            targetModel: InquiryResourceModel.User,
            targetUserId: target.id,
            targetOrganizationId: null,
            targetSpaceId: null,
          },
          'targeted',
        ),
      ).rejects.toThrow(/already exists/);
    });

    it('passes when an open inquiry shares source but has a DIFFERENT target', async () => {
      const { entity: source, context: sourceCtx } = await createUser();
      const { entity: existingTarget } = await createUser();
      const { entity: newTarget } = await createUser();

      await createInquiry(
        {
          type: InquiryType.inviteOrganizationUser,
          status: InquiryStatus.sent,
          sourceModel: InquiryResourceModel.User,
          sourceUserId: source.id,
          targetModel: InquiryResourceModel.User,
          targetUserId: existingTarget.id,
        },
        sourceCtx,
      );

      await expect(
        validateUniqueInquiry(
          db,
          {
            type: InquiryType.inviteOrganizationUser,
            sourceModel: InquiryResourceModel.User,
            sourceUserId: source.id,
            sourceOrganizationId: null,
            sourceSpaceId: null,
            targetModel: InquiryResourceModel.User,
            targetUserId: newTarget.id,
            targetOrganizationId: null,
            targetSpaceId: null,
          },
          'targeted',
        ),
      ).resolves.toBeUndefined();
    });

    it('passes when type differs (same source+target, different inquiry type is OK)', async () => {
      const { entity: source, context: sourceCtx } = await createUser();
      const { entity: target } = await createUser();
      await createInquiry(
        {
          type: InquiryType.inviteOrganizationUser,
          status: InquiryStatus.sent,
          sourceModel: InquiryResourceModel.User,
          sourceUserId: source.id,
          targetModel: InquiryResourceModel.User,
          targetUserId: target.id,
        },
        sourceCtx,
      );

      // Different type → allowed even with identical source+target
      await expect(
        validateUniqueInquiry(
          db,
          {
            type: InquiryType.transferSpace,
            sourceModel: InquiryResourceModel.User,
            sourceUserId: source.id,
            sourceOrganizationId: null,
            sourceSpaceId: null,
            targetModel: InquiryResourceModel.User,
            targetUserId: target.id,
            targetOrganizationId: null,
            targetSpaceId: null,
          },
          'targeted',
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('self-collision exclusion', () => {
    it('untargeted: does NOT match the current inquiry by id (the row being re-validated)', async () => {
      const { entity: org, context: orgCtx } = await createOrganization();
      const { entity: existing } = await createInquiry(
        {
          type: InquiryType.createSpace,
          status: InquiryStatus.sent,
          sourceModel: InquiryResourceModel.Organization,
          sourceOrganizationId: org.id,
          targetModel: InquiryResourceModel.admin,
        },
        orgCtx,
      );

      // Re-validating the same row (e.g. on an update path) — must skip itself.
      await expect(
        validateUniqueInquiry(
          db,
          {
            id: existing.id,
            type: InquiryType.createSpace,
            sourceModel: InquiryResourceModel.Organization,
            sourceOrganizationId: org.id,
            sourceUserId: null,
            sourceSpaceId: null,
            targetModel: InquiryResourceModel.admin,
            targetUserId: null,
            targetOrganizationId: null,
            targetSpaceId: null,
          },
          'untargeted',
        ),
      ).resolves.toBeUndefined();
    });

    it('targeted: does NOT match the current inquiry by id', async () => {
      const { entity: source, context: sourceCtx } = await createUser();
      const { entity: target } = await createUser();
      const { entity: existing } = await createInquiry(
        {
          type: InquiryType.inviteOrganizationUser,
          status: InquiryStatus.sent,
          sourceModel: InquiryResourceModel.User,
          sourceUserId: source.id,
          targetModel: InquiryResourceModel.User,
          targetUserId: target.id,
        },
        sourceCtx,
      );

      await expect(
        validateUniqueInquiry(
          db,
          {
            id: existing.id,
            type: InquiryType.inviteOrganizationUser,
            sourceModel: InquiryResourceModel.User,
            sourceUserId: source.id,
            sourceOrganizationId: null,
            sourceSpaceId: null,
            targetModel: InquiryResourceModel.User,
            targetUserId: target.id,
            targetOrganizationId: null,
            targetSpaceId: null,
          },
          'targeted',
        ),
      ).resolves.toBeUndefined();
    });

    it('targeted: still throws when a DIFFERENT row matches, even with id provided', async () => {
      const { entity: source, context: sourceCtx } = await createUser();
      const { entity: target } = await createUser();

      // First inquiry — the "existing" duplicate.
      await createInquiry(
        {
          type: InquiryType.inviteOrganizationUser,
          status: InquiryStatus.sent,
          sourceModel: InquiryResourceModel.User,
          sourceUserId: source.id,
          targetModel: InquiryResourceModel.User,
          targetUserId: target.id,
        },
        sourceCtx,
      );

      // Second inquiry — this one is being re-validated; its own id should
      // be excluded but the FIRST one still trips the check.
      const { entity: secondDraft } = await createInquiry(
        {
          type: InquiryType.inviteOrganizationUser,
          status: InquiryStatus.draft,
          sourceModel: InquiryResourceModel.User,
          sourceUserId: source.id,
          targetModel: InquiryResourceModel.User,
          targetUserId: target.id,
        },
        sourceCtx,
      );

      await expect(
        validateUniqueInquiry(
          db,
          {
            id: secondDraft.id,
            type: InquiryType.inviteOrganizationUser,
            sourceModel: InquiryResourceModel.User,
            sourceUserId: source.id,
            sourceOrganizationId: null,
            sourceSpaceId: null,
            targetModel: InquiryResourceModel.User,
            targetUserId: target.id,
            targetOrganizationId: null,
            targetSpaceId: null,
          },
          'targeted',
        ),
      ).rejects.toThrow(/already exists/);
    });
  });
});

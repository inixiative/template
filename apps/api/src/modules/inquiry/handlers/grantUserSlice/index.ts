/**
 * @atlas
 * @kind handler
 * @partOf feature:inquiry, primitive:authz
 * @uses infrastructure:prisma
 */
import type { Db, UserId } from '@template/db';
import { InquiryResourceModel, Role } from '@template/db/generated/client/enums';
import { z } from 'zod';
import { makeError } from '#/lib/errors';
import { findActionsUserLacks } from '#/lib/permissions/findActionsUserLacks';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';
import { findUserWithRelations } from '#/modules/user/services/find';

export const sliceSchema = z.object({
  role: z.nativeEnum(Role),
  entitlements: z.record(z.string(), z.boolean()).nullable(),
  entitlementsOnly: z.boolean(),
});

const contentSchema = sliceSchema.extend({
  purpose: z.string().min(1).max(500),
  role: z.nativeEnum(Role).default(Role.viewer),
  entitlements: z.record(z.string(), z.boolean()).nullable().default(null),
  entitlementsOnly: z.boolean().default(false),
});

const resolutionSchema = baseResolutionInputSchema.extend({ slice: sliceSchema.optional() });

type GrantUserSliceContent = z.infer<typeof contentSchema>;
type GrantUserSliceResolution = z.infer<typeof resolutionSchema>;

const validate = async (
  db: Db,
  inquiry: Partial<Inquiry>,
  content: GrantUserSliceContent,
): Promise<void> => {
  if (
    inquiry.sourceModel === InquiryResourceModel.User &&
    inquiry.sourceUserId !== inquiry.targetUserId
  )
    throw makeError({ status: 422, message: 'A user can only ask for a slice of themselves' });

  const targetUser = await findUserWithRelations(db, inquiry.targetUserId as UserId);
  if (!targetUser) throw makeError({ status: 404, message: 'Target user not found' });

  const lacking = findActionsUserLacks(targetUser, content.entitlements);
  if (lacking.length)
    throw makeError({
      status: 422,
      message: `The user does not hold these actions: ${lacking.join(', ')}`,
    });
};

const autoApprove = async (db: Db, inquiry: Inquiry): Promise<boolean> => {
  if (inquiry.sourceModel === InquiryResourceModel.User)
    return inquiry.sourceUserId === inquiry.targetUserId;
  if (!inquiry.sourceIntegrationId) return false;
  const integration = await db.integration.findUnique({
    where: { id: inquiry.sourceIntegrationId },
  });
  return integration?.ownerModel === 'User' && integration.userId === inquiry.targetUserId;
};

export const grantUserSliceHandler: InquiryHandler<
  GrantUserSliceContent,
  GrantUserSliceResolution
> = {
  sources: [
    { sourceModel: InquiryResourceModel.User },
    { sourceModel: InquiryResourceModel.Integration },
  ],
  targets: [{ targetModel: InquiryResourceModel.User }],
  contentSchema,
  resolutionInputSchema: baseResolutionInputSchema,
  resolutionSchema,
  defaultExpirationDays: 7,
  validate,
  autoApprove,
  revocable: true,
  grantOf: ({ role, entitlements, entitlementsOnly }) => ({ role, entitlements, entitlementsOnly }),

  handleApprove: async (db, inquiry, content) => {
    await validate(db, inquiry, content);
    const { role, entitlements, entitlementsOnly } = content;
    return { slice: { role, entitlements, entitlementsOnly } };
  },
};

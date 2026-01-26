import type { ExtendedPrismaClient, InquiryResourceModel, OrganizationRole } from '@template/db';

type InquiryLike = {
  sourceModel: InquiryResourceModel;
  sourceUserId: string | null;
  sourceOrganizationId: string | null;
  targetModel: InquiryResourceModel | null;
  targetUserId: string | null;
  targetOrganizationId: string | null;
};

export const getUserOrganizationIds = async (
  db: ExtendedPrismaClient,
  userId: string,
  roles: OrganizationRole[],
): Promise<string[]> => {
  const memberships = await db.organizationUser.findMany({
    where: { userId, role: { in: roles } },
    select: { organizationId: true },
  });
  return memberships.map((m: { organizationId: string }) => m.organizationId);
};

export const checkInquiryAccess = async (
  db: ExtendedPrismaClient,
  inquiry: InquiryLike,
  userId: string,
): Promise<boolean> => {
  return (await checkIsSource(db, inquiry, userId)) || (await checkIsTarget(db, inquiry, userId));
};

export const checkIsSource = async (
  db: ExtendedPrismaClient,
  inquiry: InquiryLike,
  userId: string,
): Promise<boolean> => {
  if (inquiry.sourceModel === 'User') {
    return inquiry.sourceUserId === userId;
  }
  if (!inquiry.sourceOrganizationId) return false;
  const membership = await db.organizationUser.findUnique({
    where: { organizationId_userId: { organizationId: inquiry.sourceOrganizationId, userId } },
  });
  return !!membership && ['owner', 'admin'].includes(membership.role);
};

export const checkIsTarget = async (
  db: ExtendedPrismaClient,
  inquiry: InquiryLike,
  userId: string,
): Promise<boolean> => {
  if (!inquiry.targetModel) return false;

  if (inquiry.targetModel === 'User') {
    return inquiry.targetUserId === userId;
  }
  if (!inquiry.targetOrganizationId) return false;
  const membership = await db.organizationUser.findUnique({
    where: { organizationId_userId: { organizationId: inquiry.targetOrganizationId, userId } },
  });
  return !!membership && ['owner', 'admin'].includes(membership.role);
};

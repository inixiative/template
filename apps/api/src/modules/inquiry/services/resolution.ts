import type { ExtendedPrismaClient, OrganizationRole, Prisma } from '@template/db';

type Inquiry = Prisma.InquiryGetPayload<{}>;

type ResolutionOutcome = 'approved' | 'denied' | 'canceled';

export const resolveInquiry = async (
  db: ExtendedPrismaClient,
  inquiry: Inquiry,
  outcome: ResolutionOutcome,
  explanation: string | undefined,
  resolverId: string,
): Promise<Inquiry> => {
  if (outcome === 'approved') {
    await executeResolution(db, inquiry);
  }

  const resolution = {
    outcome,
    explanation,
    resolvedBy: resolverId,
    resolvedAt: new Date().toISOString(),
  };

  return db.inquiry.update({
    where: { id: inquiry.id },
    data: { status: 'resolved', resolution },
  });
};

const executeResolution = async (db: ExtendedPrismaClient, inquiry: Inquiry): Promise<void> => {
  const content = inquiry.content as Record<string, unknown>;

  if (inquiry.type === 'memberInvitation') {
    if (!inquiry.targetUserId || inquiry.targetModel !== 'User') {
      throw new Error('Invalid invitation: target must be a user');
    }
    const orgId = (content.organizationId as string) ?? inquiry.sourceOrganizationId;
    const role = (content.role as OrganizationRole) ?? 'member';

    const existing = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: orgId!, userId: inquiry.targetUserId } },
    });
    if (existing) throw new Error('User is already a member');

    await db.organizationUser.create({
      data: { organizationId: orgId!, userId: inquiry.targetUserId, role },
    });
  }

  if (inquiry.type === 'memberApplication') {
    if (!inquiry.targetOrganizationId || inquiry.targetModel !== 'Organization') {
      throw new Error('Invalid application: target must be an organization');
    }
    const role = (content.role as OrganizationRole) ?? 'member';

    const existing = await db.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: inquiry.targetOrganizationId, userId: inquiry.sourceUserId! } },
    });
    if (existing) throw new Error('User is already a member');

    await db.organizationUser.create({
      data: { organizationId: inquiry.targetOrganizationId, userId: inquiry.sourceUserId!, role },
    });
  }
};

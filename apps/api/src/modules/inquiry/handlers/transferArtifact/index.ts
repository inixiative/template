/**
 * @atlas
 * @kind handler
 * @partOf feature:inquiry, feature:files
 * @uses infrastructure:prisma
 */
import { type Db, polymorphicTarget } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { makeError } from '#/lib/errors';
import { type OwnedArtifact, sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { copyArtifactInto } from '#/modules/artifact/services/artifactPlacements';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';
import { baseResolutionInputSchema } from '#/modules/inquiry/handlers/schemas';
import {
  type TransferArtifactContent,
  transferArtifactContentSchema,
  transferArtifactResolutionInputSchema,
} from '#/modules/inquiry/handlers/transferArtifact/schema';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';

const PARTIES = [
  InquiryResourceModel.User,
  InquiryResourceModel.Organization,
  InquiryResourceModel.Space,
];

type Party = { kind: 'User' | 'Organization' | 'Space'; id: string };

const party = (inquiry: Partial<Inquiry>, axis: 'sourceModel' | 'targetModel'): Party => {
  const target = polymorphicTarget(inquiry as Record<string, unknown>, 'Inquiry', axis);
  if (!target || !PARTIES.includes(target.kind as (typeof PARTIES)[number])) {
    throw makeError({
      status: 422,
      message: 'An artifact moves between a user, an organization or a space',
    });
  }
  return target as Party;
};

const ownerOf = ({ kind, id }: Party): OwnedArtifact => ({
  ownerModel: kind,
  userId: kind === 'User' ? id : null,
  organizationId: kind === 'Organization' ? id : null,
  spaceId: kind === 'Space' ? id : null,
});

const loadOwnedObject = async (db: Db, artifactId: string, source: Party): Promise<Artifact> => {
  const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact) throw makeError({ status: 404, message: 'Artifact not found' });
  if (!sameArtifactOwner(artifact, ownerOf(source))) {
    throw makeError({ status: 422, message: 'Only the owner of an artifact can transfer it' });
  }
  const resolution = (await resolveArtifactAccess([artifact.id])).get(artifact.id);
  if (resolution?.memberScoped) {
    throw makeError({
      status: 422,
      message:
        "Org-user content can't be transferred; share it into one of the org's containers first",
    });
  }
  if (artifact.type !== 'object') {
    throw makeError({
      status: 422,
      message: 'Containers are not transferable yet; transfer what is inside them',
    });
  }
  return artifact;
};

const managesParty = async (db: Db, userId: string, target: Party): Promise<boolean> => {
  if (target.kind === 'User') return target.id === userId;
  if (target.kind === 'Organization') {
    const membership = await db.organizationUser.findFirst({
      where: { organizationId: target.id, userId, role: { in: ['owner', 'admin'] } },
    });
    return !!membership;
  }
  const membership = await db.spaceUser.findFirst({
    where: { spaceId: target.id, userId, role: { in: ['owner', 'admin'] } },
  });
  return !!membership;
};

const grantSourceRead = async (db: Db, artifactId: string, source: Party) => {
  await db.resourceBinding.create({
    data: {
      sourceModel: 'Artifact',
      artifactId,
      resourceModel: source.kind,
      bindingType: 'tracking',
      ...(source.kind === 'User' ? { userId: source.id } : {}),
      ...(source.kind === 'Organization' ? { organizationId: source.id } : {}),
      ...(source.kind === 'Space' ? { spaceId: source.id } : {}),
    },
  });
  await db.artifactPermission.create({
    data: {
      artifactId,
      granteeModel: source.kind,
      role: 'viewer',
      ...(source.kind === 'User' ? { granteeUserId: source.id } : {}),
      ...(source.kind === 'Organization' ? { granteeOrganizationId: source.id } : {}),
      ...(source.kind === 'Space' ? { granteeSpaceId: source.id } : {}),
    },
  });
};

export const transferArtifactHandler: InquiryHandler<TransferArtifactContent> = {
  sources: PARTIES.map((sourceModel) => ({ sourceModel })),
  targets: PARTIES.map((targetModel) => ({ targetModel })),
  contentSchema: transferArtifactContentSchema,
  resolutionInputSchema: transferArtifactResolutionInputSchema,
  resolutionSchema: baseResolutionInputSchema,
  defaultExpirationDays: 30,

  validate: async (db, inquiry, content) => {
    const source = party(inquiry, 'sourceModel');
    await loadOwnedObject(db, content.artifactId, source);
    const open = await db.inquiry.count({
      where: {
        type: 'transferArtifact',
        status: { in: ['draft', 'sent', 'changesRequested'] },
        content: { path: ['artifactId'], equals: content.artifactId },
        ...(inquiry.id ? { id: { not: inquiry.id } } : {}),
      },
    });
    if (open > 0) {
      throw makeError({ status: 409, message: 'This artifact already has an open transfer' });
    }
    if (inquiry.targetModel) {
      const target = party(inquiry, 'targetModel');
      if (target.kind === source.kind && target.id === source.id) {
        throw makeError({ status: 422, message: 'The artifact already belongs to that owner' });
      }
    }
  },

  autoApprove: async (db, inquiry) => {
    const source = party(inquiry, 'sourceModel');
    const actorUserId =
      auditActorContext.getScope()?.actorUserId ?? (source.kind === 'User' ? source.id : null);
    if (!actorUserId) return false;
    return managesParty(db, actorUserId, party(inquiry, 'targetModel'));
  },

  handleApprove: async (db, inquiry, content) => {
    const source = party(inquiry, 'sourceModel');
    const target = party(inquiry, 'targetModel');
    await db.findForUpdate('Artifact', { id: content.artifactId });
    const artifact = await loadOwnedObject(db, content.artifactId, source);
    const tracked = content.keepTracking && content.allowTracking !== false;

    if (content.keepTracking && content.allowTracking === false) {
      await copyArtifactInto(artifact, ownerOf(source), {});
    }
    await db.artifactPlacement.updateManyAndReturn({
      where: { artifactId: artifact.id },
      data: { deletedAt: new Date() },
    });
    await db.artifactPermission.updateManyAndReturn({
      where: { artifactId: artifact.id },
      data: { deletedAt: new Date() },
    });
    await db.artifact.update({ where: { id: artifact.id }, data: ownerOf(target) });
    if (tracked) await grantSourceRead(db, artifact.id, source);
    return {};
  },
};

/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry, feature:files
 * @uses infrastructure:prisma
 */
import { db, rowPolymorphicAxisPointsAt } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import {
  type TransferArtifactContent,
  type TransferArtifactResolutionInput,
  transferArtifactContentSchema,
  transferArtifactResolutionInputSchema,
} from '@template/shared/inquiry';
import { makeError } from '#/lib/errors';
import { type OwnedArtifact, sameArtifactOwner } from '#/modules/artifact/lib/artifactOwner';
import { copyArtifactInto } from '#/modules/artifact/services/artifactPlacements';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';
import type { Inquiry, InquiryService } from '#/modules/inquiry/services/types';

const PARTIES = [
  InquiryResourceModel.User,
  InquiryResourceModel.Organization,
  InquiryResourceModel.Space,
];

type Party = { model: 'User' | 'Organization' | 'Space'; id: string };

const party = (inquiry: Partial<Inquiry>, axis: 'sourceModel' | 'targetModel'): Party => {
  const target = rowPolymorphicAxisPointsAt(inquiry as Record<string, unknown>, 'Inquiry', axis);
  if (!target || !PARTIES.includes(target.model as (typeof PARTIES)[number])) {
    throw makeError({
      status: 422,
      message: 'An artifact moves between a user, an organization or a space',
    });
  }
  return target as Party;
};

const ownerOf = ({ model, id }: Party): OwnedArtifact => ({
  ownerModel: model,
  userId: model === 'User' ? id : null,
  organizationId: model === 'Organization' ? id : null,
  spaceId: model === 'Space' ? id : null,
});

const loadOwnedObject = async (artifactId: string, source: Party): Promise<Artifact> => {
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

const managesParty = async (userId: string, target: Party): Promise<boolean> => {
  if (target.model === 'User') return target.id === userId;
  if (target.model === 'Organization') {
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

const grantSourceRead = async (artifactId: string, source: Party) => {
  await db.resourceBinding.create({
    data: {
      sourceModel: 'Artifact',
      sourceArtifactId: artifactId,
      resourceModel: source.model,
      bindingType: 'tracking',
      ...(source.model === 'User' ? { resourceUserId: source.id } : {}),
      ...(source.model === 'Organization' ? { resourceOrganizationId: source.id } : {}),
      ...(source.model === 'Space' ? { resourceSpaceId: source.id } : {}),
    },
  });
  await db.artifactPermission.create({
    data: {
      artifactId,
      granteeModel: source.model,
      role: 'viewer',
      ...(source.model === 'User' ? { granteeUserId: source.id } : {}),
      ...(source.model === 'Organization' ? { granteeOrganizationId: source.id } : {}),
      ...(source.model === 'Space' ? { granteeSpaceId: source.id } : {}),
    },
  });
};

export const transferArtifactService: InquiryService<
  TransferArtifactContent,
  TransferArtifactResolutionInput,
  TransferArtifactResolutionInput
> = {
  contentSchema: transferArtifactContentSchema,
  resolutionInputSchema: transferArtifactResolutionInputSchema,
  resolutionSchema: transferArtifactResolutionInputSchema,
  defaultExpirationDays: 30,

  validate: async (inquiry, content) => {
    const source = party(inquiry, 'sourceModel');
    await loadOwnedObject(content.artifactId, source);
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
      if (target.model === source.model && target.id === source.id) {
        throw makeError({ status: 422, message: 'The artifact already belongs to that owner' });
      }
    }
  },

  autoApprove: async (inquiry) => {
    const source = party(inquiry, 'sourceModel');
    const actorUserId =
      auditActorContext.currentActor()?.actorUserId ?? (source.model === 'User' ? source.id : null);
    if (!actorUserId) return false;
    return managesParty(actorUserId, party(inquiry, 'targetModel'));
  },

  handleApprove: async (_c, inquiry, content, response) => {
    const source = party(inquiry, 'sourceModel');
    const target = party(inquiry, 'targetModel');
    await db.findForUpdate('Artifact', { id: content.artifactId });
    const artifact = await loadOwnedObject(content.artifactId, source);
    const allowTracking = response.allowTracking ?? content.allowTracking;
    const tracked = content.keepTracking && allowTracking !== false;

    if (content.keepTracking && allowTracking === false) {
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
    if (tracked) await grantSourceRead(artifact.id, source);
    return {};
  },
};

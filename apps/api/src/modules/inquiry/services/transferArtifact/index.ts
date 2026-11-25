/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry, feature:files
 * @uses infrastructure:prisma
 */
import { db, polymorphicKeyColumnOrThrow, rowPolymorphicAxisPointsAt } from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import { isContainerKind } from '@template/shared/artifact';
import {
  type TransferArtifactContent,
  type TransferArtifactResolutionInput,
  transferArtifactContentSchema,
  transferArtifactResolutionInputSchema,
} from '@template/shared/inquiry';
import type { ResourceBindingType } from '@template/shared/resourceBinding';
import { makeError } from '#/lib/errors';
import {
  type OwnedArtifact,
  ownerColumns,
  sameArtifactOwner,
  withArtifactOwnersLock,
} from '#/modules/artifact/services/artifactOwner';
import { copyArtifactInto } from '#/modules/artifact/services/copyArtifact';
import type { Inquiry, InquiryService } from '#/modules/inquiry/services/types';
import { openInquiryWhere } from '#/modules/inquiry/validations/validateInquiryStatus';

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

const fetchOwnerOf = async ({ model, id }: Party): Promise<OwnedArtifact> => {
  if (model === 'Space') {
    const space = await db.space.findUnique({ where: { id }, select: { organizationId: true } });
    if (!space) throw makeError({ status: 404, message: 'Space not found' });
    return ownerColumns({ ownerModel: 'Space', organizationId: space.organizationId, spaceId: id });
  }
  return ownerColumns({
    ownerModel: model,
    [polymorphicKeyColumnOrThrow('Artifact', 'ownerModel', model)]: id,
  });
};

const fetchOwnedObject = async (artifactId: string, source: Party): Promise<Artifact> => {
  const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
  const expectedOwner = await fetchOwnerOf(source);
  if (!artifact || !sameArtifactOwner(artifact, expectedOwner)) {
    throw makeError({ status: 404, message: 'Artifact not found' });
  }
  if (isContainerKind(artifact.kind)) {
    throw makeError({
      status: 422,
      message: 'Containers are not transferable yet; transfer what is inside them',
    });
  }
  return artifact;
};

const grantSourceRead = async (artifactId: string, source: Party) => {
  const bindingType: ResourceBindingType = 'tracking';
  const resourceKey = polymorphicKeyColumnOrThrow('ResourceBinding', 'resourceModel', source.model);
  const existingBinding = await db.resourceBinding.findFirst({
    where: {
      sourceModel: 'Artifact',
      sourceArtifactId: artifactId,
      resourceModel: source.model,
      bindingType,
      [resourceKey]: source.id,
    },
  });
  if (!existingBinding) {
    await db.resourceBinding.create({
      data: {
        sourceModel: 'Artifact',
        sourceArtifactId: artifactId,
        resourceModel: source.model,
        bindingType,
        [resourceKey]: source.id,
      },
    });
  }
  await db.artifactPermission.create({
    data: {
      artifactId,
      granteeModel: source.model,
      role: 'viewer',
      [polymorphicKeyColumnOrThrow('ArtifactPermission', 'granteeModel', source.model)]: source.id,
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
    await fetchOwnedObject(content.artifactId, source);
    const open = await db.inquiry.count({
      where: {
        ...openInquiryWhere(),
        type: 'transferArtifact',
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

  autoApprove: async () => false,

  handleApprove: async (_c, inquiry, content, response) => {
    const source = party(inquiry, 'sourceModel');
    const target = party(inquiry, 'targetModel');
    if (target.model === source.model && target.id === source.id) {
      throw makeError({ status: 422, message: 'The artifact already belongs to that owner' });
    }
    const sourceOwner = await fetchOwnerOf(source);
    const targetOwner = await fetchOwnerOf(target);
    const existingPlacements = await db.artifactPlacement.findMany({
      where: { artifactId: content.artifactId },
      select: { ownerModel: true, userId: true, organizationId: true, spaceId: true },
    });
    const lockTargets: OwnedArtifact[] = [sourceOwner, targetOwner, ...existingPlacements];

    await withArtifactOwnersLock(lockTargets, async () => {
      const [artifact] = await db.findForUpdate<Artifact>('Artifact', { id: content.artifactId });
      if (!artifact || artifact.deletedAt || !sameArtifactOwner(artifact, sourceOwner)) {
        throw makeError({ status: 404, message: 'Artifact not found' });
      }
      if (isContainerKind(artifact.kind)) {
        throw makeError({
          status: 422,
          message: 'Containers are not transferable yet; transfer what is inside them',
        });
      }
      const allowTracking = response.allowTracking ?? content.allowTracking;
      const tracked = content.keepTracking && allowTracking !== false;

      if (content.keepTracking && allowTracking === false) {
        await copyArtifactInto(artifact, sourceOwner, {});
      }
      await db.artifactPlacement.updateManyAndReturn({
        where: { artifactId: artifact.id },
        data: { deletedAt: new Date() },
      });
      await db.artifactPermission.updateManyAndReturn({
        where: { artifactId: artifact.id },
        data: { deletedAt: new Date() },
      });
      await db.artifact.update({ where: { id: artifact.id }, data: targetOwner });
      if (tracked) await grantSourceRead(artifact.id, source);
    });
    return {};
  },
};

/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import { db, type Prisma } from '@template/db';
import type { Artifact, ArtifactContainer } from '@template/db/generated/client/client';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import { artifactKindDef, isContainerKind, isOwnerRootKind } from '@template/shared/artifact';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import type { ArtifactActor } from '#/modules/artifact/lib/artifactActor';
import { ARTIFACT_EDGE_AUTHORITY } from '#/modules/artifact/lib/artifactEdgeAuthority';
import {
  artifactOwner,
  ownerColumns,
  sameArtifactOwner,
} from '#/modules/artifact/lib/artifactOwner';
import { assertArtifactAction } from '#/modules/artifact/lib/assertArtifactAction';
import { assertContainable } from '#/modules/artifact/lib/assertContainable';
import { assertNoContainerCycle } from '#/modules/artifact/services/assertNoContainerCycle';
import { assertOwnersOnlyStaysHome } from '#/modules/artifact/services/assertOwnersOnlyStaysHome';
import { checkArtifactAccess } from '#/modules/artifact/services/checkArtifactAccess';
import { ensureOwnerRoot } from '#/modules/artifact/services/ensureOwnerRoot';
import { listOwnContainerPlacements } from '#/modules/artifact/services/listOwnPlacements';
import { resolveArtifactAccess } from '#/modules/artifact/services/resolveArtifactAccess';

export type PlaceArtifactInput = {
  artifactId: string;
  containerArtifactId: string;
  inherit?: boolean;
};

export type CreatorGrant = Omit<
  Prisma.ArtifactPermissionUncheckedCreateInput,
  'artifactId' | 'role'
>;

export type CreateArtifactInput = Omit<Prisma.ArtifactUncheckedCreateInput, 'access'> & {
  access?: ArtifactAccess;
  containerArtifactId?: string;
  creatorGrant?: CreatorGrant;
};

const assertAction = async (
  actor: ArtifactActor,
  artifactId: string,
  action: 'operate' | 'manage',
) => {
  const verdicts = await checkArtifactAccess(actor, [artifactId], action);
  assertArtifactAction(verdicts.get(artifactId), action);
};

const loadContainer = async (member: Artifact, containerArtifactId: string) => {
  const container = await db.artifact.findUnique({ where: { id: containerArtifactId } });
  if (!container) throw makeError({ status: 404, message: 'Artifact not found' });
  if (isOwnerRootKind(container.kind)) {
    throw makeError({ status: 422, message: "Every artifact already sits in its owner's root" });
  }
  assertContainable(container, member);
  if (!sameArtifactOwner(container, member)) {
    const resolution = (await resolveArtifactAccess([member.id])).get(member.id);
    if (resolution?.ownersOnly) {
      throw makeError({
        status: 422,
        message: "Org-user content can't be placed in another owner's container",
      });
    }
  }
  return container;
};

const hasNonRootPlacement = async (member: Artifact): Promise<boolean> =>
  (await db.artifactContainer.count({
    where: { artifactId: member.id, containerArtifact: { kind: { not: 'ownerRoot' } } },
  })) > 0;

const writeRootPlacement = async (member: Artifact): Promise<void> => {
  const root = await ensureOwnerRoot(member);
  await db.artifactContainer.create({
    data: { artifactId: member.id, containerArtifactId: root.id },
  });
};

const writePlacement = async (
  member: Artifact,
  container: Artifact,
  inherit: boolean | undefined,
): Promise<ArtifactContainer> => {
  if (isContainerKind(member.kind)) await assertNoContainerCycle(container.id, member.id);
  const takeInherit = inherit ?? (await listOwnContainerPlacements(member)).length === 0;
  if (inherit === false && member.access === 'inherit' && !(await hasNonRootPlacement(member))) {
    await db.artifact.update({
      where: { id: member.id },
      data: { access: artifactKindDef(member.kind)?.defaultAccess ?? 'private' },
    });
  }
  const edge = await db.artifactContainer.create({
    data: { artifactId: member.id, containerArtifactId: container.id },
  });
  if (takeInherit && member.access !== 'inherit') {
    await db.artifact.update({ where: { id: member.id }, data: { access: 'inherit' } });
  }
  if (sameArtifactOwner(member, container)) await assertOwnersOnlyStaysHome([member.id]);
  return edge;
};

export const placeArtifact = async (
  actor: ArtifactActor,
  { artifactId, containerArtifactId, inherit }: PlaceArtifactInput,
): Promise<ArtifactContainer> => {
  await assertAction(actor, artifactId, ARTIFACT_EDGE_AUTHORITY.member);
  await assertAction(actor, containerArtifactId, ARTIFACT_EDGE_AUTHORITY.container);
  const member = await db.artifact.findUnique({ where: { id: artifactId } });
  if (!member) throw makeError({ status: 404, message: 'Artifact not found' });

  return withOwnerLock(artifactOwner(member), 'containers', () =>
    db.txn(async () => {
      const container = await loadContainer(member, containerArtifactId);
      return writePlacement(member, container, inherit);
    }),
  );
};

export const createArtifact = async (
  actor: ArtifactActor,
  { containerArtifactId, access, creatorGrant, ...data }: CreateArtifactInput,
): Promise<Artifact> => {
  if (containerArtifactId)
    await assertAction(actor, containerArtifactId, ARTIFACT_EDGE_AUTHORITY.container);

  return withOwnerLock(artifactOwner(ownerColumns(data)), 'containers', () =>
    db.txn(async () => {
      const artifact = await db.artifact.create({
        data: { ...data, ...(access && access !== 'inherit' ? { access } : {}) },
      });
      if (creatorGrant) {
        await db.artifactPermission.create({
          data: { ...creatorGrant, artifactId: artifact.id, role: 'owner' },
        });
      }
      await writeRootPlacement(artifact);
      if (containerArtifactId) {
        const container = await loadContainer(artifact, containerArtifactId);
        await writePlacement(artifact, container, (access ?? 'inherit') === 'inherit');
      }
      return db.artifact.findUniqueOrThrow({ where: { id: artifact.id } });
    }),
  );
};

/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses infrastructure:prisma, mutex
 */
import {
  cacheKey,
  db,
  emptySideKeyColumns,
  fetchThroughCache,
  polymorphicArmKeys,
  polymorphicAxis,
  polymorphicKeyColumns,
  toModelName,
} from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { ArtifactKind, ArtifactOwnerModel } from '@template/db/generated/client/enums';
import type { Context } from 'hono';
import { actingUser } from '#/lib/context/actingUser';
import { makeError } from '#/lib/errors';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import type { AppEnv } from '#/types/appEnv';

export type OwnedArtifact = Pick<Artifact, 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'>;
export type OwnerRef = Pick<OwnedArtifact, 'ownerModel'> & Partial<OwnedArtifact>;

export const artifactOwner = (
  artifact: OwnedArtifact,
): { ownerModel: string; ownerId: string } => ({
  ownerModel: artifact.ownerModel,
  ownerId: polymorphicKeyColumns('Artifact', 'ownerModel', artifact.ownerModel)
    .map((column) => String(artifact[column as keyof OwnedArtifact]))
    .join(':'),
});

export const sameArtifactOwner = (a: OwnedArtifact, b: OwnedArtifact): boolean => {
  const left = artifactOwner(a);
  const right = artifactOwner(b);
  return left.ownerModel === right.ownerModel && left.ownerId === right.ownerId;
};

export const ownerRefForRow = (
  model: ArtifactOwnerModel,
  row: Record<string, unknown>,
): OwnerRef | null => {
  if (!(model in ArtifactOwnerModel)) return null;
  const keys = polymorphicArmKeys('Artifact', 'ownerModel', model, row);
  const values = Object.values(keys);
  if (values.length === 0 || values.some((value) => typeof value !== 'string')) return null;
  return { ownerModel: model, ...(keys as Partial<OwnedArtifact>) };
};

export const contextArtifactOwner = (c: Context<AppEnv>): OwnerRef => {
  const resourceType = c.get('resourceType');
  const resource = c.get('resource') as Record<string, unknown> | undefined;
  if (resourceType && resource) {
    const ref = ownerRefForRow(toModelName(resourceType) as ArtifactOwnerModel, resource);
    if (ref) return ref;
  }
  const user = actingUser(c);
  if (!user) throw makeError({ status: 401, message: 'Unauthorized' });
  return { ownerModel: 'User', userId: user.id };
};

export const targetOwnerFromBody = (
  body: Partial<OwnedArtifact>,
  c?: Context<AppEnv>,
): OwnerRef => {
  if (body.ownerModel) {
    return {
      ownerModel: body.ownerModel,
      userId: body.userId,
      organizationId: body.organizationId,
      spaceId: body.spaceId,
    };
  }
  const user = c ? actingUser(c) : null;
  if (!user) {
    throw makeError({
      status: 400,
      message: 'Provide targetContainerArtifactId or ownerModel when acting without a user',
    });
  }
  return { ownerModel: 'User', userId: user.id };
};

export const withArtifactOwnersLock = <T>(
  artifacts: OwnedArtifact[],
  fn: () => Promise<T>,
): Promise<T> => {
  const unique = new Map<string, { ownerModel: string; ownerId: string }>();
  for (const artifact of artifacts) {
    const owner = artifactOwner(artifact);
    unique.set(`${owner.ownerModel}:${owner.ownerId}`, owner);
  }
  const ordered = [...unique.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  const acquire = (index: number): Promise<T> => {
    const owner = ordered[index];
    if (!owner) return fn();
    return withOwnerLock(owner, 'containers', () => acquire(index + 1));
  };
  return acquire(0);
};

const lockArtifactsInTxn = async (ids: string[]): Promise<Map<string, Artifact>> => {
  const locked = new Map<string, Artifact>();
  for (const id of [...new Set(ids)].sort()) {
    const [row] = await db.findForUpdate<Artifact>('Artifact', { id });
    if (!row) throw makeError({ status: 404, message: 'Artifact not found' });
    locked.set(id, row);
  }
  return locked;
};

export const withLockedArtifacts = <T>(
  artifacts: Artifact[],
  fn: (locked: Map<string, Artifact>) => Promise<T>,
): Promise<T> =>
  withArtifactOwnersLock(artifacts, () =>
    db.txn(async () => {
      const locked = await lockArtifactsInTxn(artifacts.map((artifact) => artifact.id));
      for (const prelocked of artifacts) {
        if (!sameArtifactOwner(locked.get(prelocked.id)!, prelocked)) {
          throw makeError({
            status: 409,
            message: 'Artifact ownership changed while waiting for lock; please retry',
          });
        }
      }
      return fn(locked);
    }),
  );

const emptyOwnerKeys = emptySideKeyColumns(polymorphicAxis('Artifact', 'ownerModel')) as Pick<
  OwnedArtifact,
  'userId' | 'organizationId' | 'spaceId'
>;

export const ownerColumns = (artifact: OwnerRef): OwnedArtifact => {
  const picked: Partial<OwnedArtifact> = {};
  for (const column of polymorphicKeyColumns('Artifact', 'ownerModel', artifact.ownerModel)) {
    const key = column as keyof Pick<OwnedArtifact, 'userId' | 'organizationId' | 'spaceId'>;
    if (artifact[key] != null) picked[key] = artifact[key];
  }
  return { ...emptyOwnerKeys, ownerModel: artifact.ownerModel, ...picked };
};

export const ownerRootCacheKey = (owner: OwnedArtifact): string => {
  const { ownerModel, ownerId } = artifactOwner(owner);
  return cacheKey('artifact', { root: `${ownerModel}:${ownerId}` });
};

export const fetchOwnerRootArtifactOrThrow = async (owner: OwnerRef): Promise<Artifact> => {
  const columns = ownerColumns(owner);
  const root = await fetchThroughCache(ownerRootCacheKey(columns), () =>
    db.artifact.findFirst({ where: { ...columns, kind: ArtifactKind.root } }),
  );
  if (!root) throw makeError({ status: 404, message: 'Owner root container not found' });
  return root;
};

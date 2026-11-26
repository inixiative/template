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
  polymorphicAxis,
  polymorphicKeyColumns,
  toModelName,
} from '@template/db';
import type { Artifact } from '@template/db/generated/client/client';
import { ArtifactKind, type ArtifactOwnerModel } from '@template/db/generated/client/enums';
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
  switch (model) {
    case 'User':
      return typeof row.id === 'string' ? { ownerModel: 'User', userId: row.id } : null;
    case 'Organization':
      return typeof row.id === 'string'
        ? { ownerModel: 'Organization', organizationId: row.id }
        : null;
    case 'Space':
      return typeof row.id === 'string' && typeof row.organizationId === 'string'
        ? { ownerModel: 'Space', organizationId: row.organizationId, spaceId: row.id }
        : null;
    case 'OrganizationUser':
      return typeof row.organizationId === 'string' && typeof row.userId === 'string'
        ? {
            ownerModel: 'OrganizationUser',
            organizationId: row.organizationId,
            userId: row.userId,
          }
        : null;
    case 'SpaceUser':
      return typeof row.organizationId === 'string' &&
        typeof row.spaceId === 'string' &&
        typeof row.userId === 'string'
        ? {
            ownerModel: 'SpaceUser',
            organizationId: row.organizationId,
            spaceId: row.spaceId,
            userId: row.userId,
          }
        : null;
  }
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

export const lockArtifactsInTxn = async (ids: string[]): Promise<Map<string, Artifact>> => {
  const sorted = [...new Set(ids)].sort();
  const locked = new Map<string, Artifact>();
  for (const id of sorted) {
    const [row] = await db.findForUpdate<Artifact>('Artifact', { id });
    if (!row || row.deletedAt) throw makeError({ status: 404, message: 'Artifact not found' });
    locked.set(id, row);
  }
  return locked;
};

export const withLockedArtifacts = <T>(
  artifacts: Artifact[],
  fn: (locked: Map<string, Artifact>) => Promise<T>,
  extraOwners: OwnedArtifact[] = [],
): Promise<T> =>
  withArtifactOwnersLock([...artifacts, ...extraOwners], () =>
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
  const allowed = new Set(polymorphicKeyColumns('Artifact', 'ownerModel', artifact.ownerModel));
  return {
    ...emptyOwnerKeys,
    ownerModel: artifact.ownerModel,
    ...(allowed.has('userId') && artifact.userId != null ? { userId: artifact.userId } : {}),
    ...(allowed.has('organizationId') && artifact.organizationId != null
      ? { organizationId: artifact.organizationId }
      : {}),
    ...(allowed.has('spaceId') && artifact.spaceId != null ? { spaceId: artifact.spaceId } : {}),
  };
};

export const ownerRootCacheKey = (owner: Partial<OwnedArtifact>): string | null => {
  if (!owner.ownerModel) return null;
  const columns = polymorphicKeyColumns('Artifact', 'ownerModel', owner.ownerModel);
  const values: string[] = [];
  for (const column of columns) {
    const value = owner[column as keyof OwnedArtifact];
    if (typeof value !== 'string' || value.length === 0) return null;
    values.push(value);
  }
  return cacheKey('artifact', { root: `${owner.ownerModel}:${values.join(':')}` });
};

export const fetchOwnerRootArtifactOrThrow = async (owner: OwnerRef): Promise<Artifact> => {
  const columns = ownerColumns(owner);
  const key = ownerRootCacheKey(columns);
  const fetchRoot = () => db.artifact.findFirst({ where: { ...columns, kind: ArtifactKind.root } });
  const root = key ? await fetchThroughCache(key, fetchRoot) : await fetchRoot();
  if (!root) throw makeError({ status: 404, message: 'Owner root container not found' });
  return root;
};

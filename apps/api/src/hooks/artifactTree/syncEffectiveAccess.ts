/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma, primitive:caching
 */
import { db } from '@template/db';
import type { ArtifactAccess } from '@template/db/generated/client/enums';
import type { TreeAround } from '#/hooks/artifactTree/fetchArtifactTreeAround';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';
import { sameArtifactOwner } from '#/modules/artifact/services/artifactOwner';

const ACCESS_RANK: Record<'private' | 'tenant' | 'public', number> = {
  private: 0,
  tenant: 1,
  public: 2,
};

const ACCESS_BY_RANK = ['private', 'tenant', 'public'] as const;

const rankOf = (access: ArtifactAccess): number =>
  access === 'public' ? ACCESS_RANK.public : access === 'tenant' ? ACCESS_RANK.tenant : 0;

const effectiveAccessOf = ({ artifacts, externalParents }: TreeAround) => {
  const memo = new Map<string, number>();

  const walk = (artifactId: string, visiting: Set<string>): number => {
    const cached = memo.get(artifactId);
    if (cached !== undefined) return cached;

    const node = artifacts.get(artifactId);
    if (!node || node.kind === 'root' || visiting.has(artifactId)) return 0;

    const nextVisiting = new Set(visiting).add(artifactId);
    const hasTenant = node.ownerModel !== 'User';
    let best = 0;

    for (const { containerArtifactId: parentId, access } of node.placements) {
      const internalParent = artifacts.get(parentId);
      const parent = internalParent ?? externalParents.get(parentId);
      if (!parent || !sameArtifactOwner(node, parent)) continue;

      let contribution = 0;
      if (access === 'public') {
        contribution = ACCESS_RANK.public;
      } else if (access === 'tenant') {
        contribution = hasTenant ? ACCESS_RANK.tenant : 0;
      } else if (access === 'inherit') {
        if (parent.kind !== 'root') {
          contribution = internalParent
            ? walk(parentId, nextVisiting)
            : rankOf(parent.effectiveAccess);
          if (!hasTenant && contribution === ACCESS_RANK.tenant) contribution = 0;
        }
      }
      if (contribution > best) best = contribution;
    }

    memo.set(artifactId, best);
    return best;
  };

  return (artifactId: string): 'private' | 'tenant' | 'public' =>
    ACCESS_BY_RANK[walk(artifactId, new Set())]!;
};

export const syncEffectiveAccess = async (
  artifactIds: string[],
  tree: TreeAround,
): Promise<void> => {
  const resolveAccess = effectiveAccessOf(tree);
  const byTarget: Record<'private' | 'tenant' | 'public', string[]> = {
    private: [],
    tenant: [],
    public: [],
  };
  const changedIds: string[] = [];

  for (const id of artifactIds) {
    const desired = resolveAccess(id);
    if (tree.artifacts.get(id)?.effectiveAccess !== desired) {
      byTarget[desired].push(id);
      changedIds.push(id);
    }
  }

  for (const access of ACCESS_BY_RANK) {
    const ids = byTarget[access];
    if (ids.length === 0) continue;
    await db.artifact.updateManyAndReturn({
      where: { id: { in: ids } },
      data: { effectiveAccess: access },
    });
  }

  if (changedIds.length > 0) {
    // why: Artifact.effectiveAccess is in NOOP_FIELDS so the cache hook skips it; invalidate directly.
    await queueCacheClear(
      'Artifact',
      changedIds.map((id) => ({ id })),
    );
  }
};

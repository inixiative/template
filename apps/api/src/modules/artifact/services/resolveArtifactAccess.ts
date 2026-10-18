/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import type { Role } from '@template/db/generated/client/enums';
import { artifactKindDef } from '@template/shared/artifact';
import {
  type ArtifactPrincipal,
  granteePrincipal,
  ownerPrincipal,
  principalKey,
} from '#/modules/artifact/lib/artifactPrincipal';
import { strongerRole } from '#/modules/artifact/lib/artifactRoles';
import {
  type ArtifactGraph,
  loadArtifactGraph,
} from '#/modules/artifact/services/loadArtifactGraph';

export type ArtifactGrant = { principal: ArtifactPrincipal; role: Role; implicit: boolean };

export type ArtifactAccessResolution = {
  artifactId: string;
  public: boolean;
  memberScoped: boolean;
  grants: ArtifactGrant[];
};

type Effective = { public: boolean; grants: Map<string, ArtifactGrant> };

const addGrant = (grants: Map<string, ArtifactGrant>, grant: ArtifactGrant): void => {
  const key = principalKey(grant.principal);
  const held = grants.get(key);
  grants.set(key, {
    principal: grant.principal,
    role: strongerRole(held?.role ?? null, grant.role)!,
    implicit: (held?.implicit ?? true) && grant.implicit,
  });
};

const memberScopedReach = (graph: ArtifactGraph) => {
  const memo = new Map<string, boolean>();
  const reach = (artifactId: string, walking: Set<string>): boolean => {
    const cached = memo.get(artifactId);
    if (cached !== undefined) return cached;
    const node = graph.get(artifactId);
    if (!node || walking.has(artifactId)) return false;
    const path = new Set(walking).add(artifactId);
    const containers = node.containerArtifactIds.filter((id) => graph.has(id));
    const scoped =
      artifactKindDef(node.kind)?.memberScoped === true ||
      (containers.length > 0 &&
        containers.every((containerArtifactId) => reach(containerArtifactId, path)));
    memo.set(artifactId, scoped);
    return scoped;
  };
  return (artifactId: string) => reach(artifactId, new Set());
};

const effectiveAccess = (
  graph: ArtifactGraph,
  now: Date,
  isMemberScoped: (artifactId: string) => boolean,
) => {
  const memo = new Map<string, Effective>();
  const resolve = (artifactId: string, walking: Set<string>): Effective => {
    const cached = memo.get(artifactId);
    if (cached) return cached;
    const node = graph.get(artifactId);
    if (!node || walking.has(artifactId)) return { public: false, grants: new Map() };

    const grants = new Map<string, ArtifactGrant>();
    addGrant(grants, {
      principal: ownerPrincipal(node, isMemberScoped(artifactId)),
      role: 'owner',
      implicit: true,
    });
    for (const permission of node.permissions) {
      if (permission.expiresAt && permission.expiresAt <= now) continue;
      addGrant(grants, {
        principal: granteePrincipal(permission),
        role: permission.role,
        implicit: false,
      });
    }

    let inheritedPublic = false;
    if (node.access !== 'private') {
      const path = new Set(walking).add(artifactId);
      for (const containerArtifactId of node.containerArtifactIds) {
        const container = resolve(containerArtifactId, path);
        inheritedPublic ||= container.public;
        for (const grant of container.grants.values()) addGrant(grants, grant);
      }
    }

    const effective = {
      public: node.access === 'public' || (node.access === 'inherit' && inheritedPublic),
      grants,
    };
    memo.set(artifactId, effective);
    return effective;
  };
  return (artifactId: string) => resolve(artifactId, new Set());
};

export const resolveArtifactAccess = async (
  artifactIds: string[],
): Promise<Map<string, ArtifactAccessResolution>> => {
  const graph = await loadArtifactGraph(artifactIds);
  const isMemberScoped = memberScopedReach(graph);
  const resolve = effectiveAccess(graph, new Date(), isMemberScoped);
  const resolutions = new Map<string, ArtifactAccessResolution>();
  for (const artifactId of artifactIds) {
    if (!graph.has(artifactId)) continue;
    const effective = resolve(artifactId);
    resolutions.set(artifactId, {
      artifactId,
      public: effective.public,
      memberScoped: isMemberScoped(artifactId),
      grants: [...effective.grants.values()],
    });
  }
  return resolutions;
};

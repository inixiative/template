/**
 * @atlas
 * @kind service
 * @partOf feature:files
 * @uses infrastructure:prisma
 */
import type { Role } from '@template/db/generated/client/enums';
import { lesserRole } from '@template/permissions';
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

export type ArtifactGrant = { principal: ArtifactPrincipal; role: Role; ownership: boolean };

export type ArtifactAccessResolution = {
  artifactId: string;
  public: boolean;
  grants: ArtifactGrant[];
};

type Effective = { public: boolean; grants: Map<string, ArtifactGrant> };

const INHERITED_OWNERSHIP_CAP: Role = 'admin';

const addGrant = (grants: Map<string, ArtifactGrant>, grant: ArtifactGrant): void => {
  const key = principalKey(grant.principal);
  const held = grants.get(key);
  grants.set(key, {
    principal: grant.principal,
    role: strongerRole(held?.role ?? null, grant.role)!,
    ownership: (held?.ownership ?? false) || grant.ownership,
  });
};

const effectiveAccess = (graph: ArtifactGraph, now: Date) => {
  const memo = new Map<string, Effective>();
  const resolve = (artifactId: string, walking: Set<string>): Effective => {
    const cached = memo.get(artifactId);
    if (cached) return cached;
    const node = graph.get(artifactId);
    if (!node || walking.has(artifactId)) return { public: false, grants: new Map() };

    const grants = new Map<string, ArtifactGrant>();
    addGrant(grants, { principal: ownerPrincipal(node), role: 'owner', ownership: true });
    for (const permission of node.permissions) {
      if (permission.expiresAt && permission.expiresAt <= now) continue;
      addGrant(grants, {
        principal: granteePrincipal(permission),
        role: permission.role,
        ownership: false,
      });
    }

    let inheritedPublic = false;
    if (node.access !== 'private') {
      const path = new Set(walking).add(artifactId);
      for (const containerArtifactId of node.containerArtifactIds) {
        const container = resolve(containerArtifactId, path);
        inheritedPublic ||= container.public;
        for (const grant of container.grants.values()) {
          addGrant(grants, {
            ...grant,
            role: grant.ownership ? lesserRole(grant.role, INHERITED_OWNERSHIP_CAP) : grant.role,
            ownership: false,
          });
        }
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
  const resolve = effectiveAccess(graph, new Date());
  const resolutions = new Map<string, ArtifactAccessResolution>();
  for (const artifactId of artifactIds) {
    if (!graph.has(artifactId)) continue;
    const effective = resolve(artifactId);
    resolutions.set(artifactId, {
      artifactId,
      public: effective.public,
      grants: [...effective.grants.values()],
    });
  }
  return resolutions;
};

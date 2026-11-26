/**
 * @atlas
 * @kind validation
 * @partOf feature:files
 * @uses none
 */
import { check } from '@inixiative/json-rules';
import type { Artifact } from '@template/db/generated/client/client';
import type {
  PlacementOperateAccess,
  PlacementReadAccess,
} from '@template/db/generated/client/enums';
import { isRootKind } from '@template/shared/artifact';
import { userTakesNoTenantAccess } from '#/hooks/rules/registry';
import { makeError } from '#/lib/errors';

export type PlacementAccess = {
  readAccess: PlacementReadAccess;
  operateAccess: PlacementOperateAccess;
};

export type PlacementAccessInput = Partial<PlacementAccess>;

const defaultPlacementAccess = (container: Pick<Artifact, 'kind'>): PlacementAccess =>
  isRootKind(container.kind)
    ? { readAccess: 'private', operateAccess: 'private' }
    : { readAccess: 'inherit', operateAccess: 'inherit' };

export const resolvePlacementAccess = (
  container: Pick<Artifact, 'kind'>,
  access?: PlacementAccessInput,
): PlacementAccess => {
  const defaults = defaultPlacementAccess(container);
  return {
    readAccess: access?.readAccess ?? defaults.readAccess,
    operateAccess: access?.operateAccess ?? defaults.operateAccess,
  };
};

export const isCustomPlacementAccess = (
  container: Pick<Artifact, 'kind'>,
  access?: PlacementAccessInput,
): boolean => {
  const defaults = defaultPlacementAccess(container);
  return (
    (access?.readAccess !== undefined && access.readAccess !== defaults.readAccess) ||
    (access?.operateAccess !== undefined && access.operateAccess !== defaults.operateAccess)
  );
};

export const validatePlacementAccess = (
  container: Pick<Artifact, 'kind' | 'ownerModel'>,
  access: PlacementAccessInput,
): void => {
  if (
    isRootKind(container.kind) &&
    (access.readAccess === 'inherit' || access.operateAccess === 'inherit')
  ) {
    throw makeError({
      status: 422,
      message: 'Root placements cannot use inherit access; choose an explicit access level',
    });
  }
  const tenantCheck = check(userTakesNoTenantAccess, {
    ownerModel: container.ownerModel,
    readAccess: access.readAccess ?? null,
    operateAccess: access.operateAccess ?? null,
  });
  if (tenantCheck !== true) {
    throw makeError({
      status: 422,
      message:
        typeof tenantCheck === 'string'
          ? tenantCheck
          : 'User-owned records cannot use tenant access',
    });
  }
};

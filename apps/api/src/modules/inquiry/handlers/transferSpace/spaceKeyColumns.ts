/**
 * @atlas
 * @kind utils
 * @partOf feature:inquiry
 * @uses infrastructure:prisma
 */
import type { Prisma } from '@template/db';
import { getModelRelations } from '@template/db/utils/prismaMapRelations';
import { uniqBy } from 'lodash-es';

export type SpaceKeyColumns = { spaceField: string; organizationField: string };

export const spaceKeyColumns = (model: Prisma.ModelName): SpaceKeyColumns[] =>
  uniqBy(
    getModelRelations(model).flatMap(({ targetModel, foreignKey }) => {
      if (typeof foreignKey !== 'object' || !foreignKey?.organizationId) return [];
      const spaceField =
        targetModel === 'Space'
          ? foreignKey.id
          : targetModel === 'SpaceUser'
            ? foreignKey.spaceId
            : undefined;
      return spaceField ? [{ spaceField, organizationField: foreignKey.organizationId }] : [];
    }),
    ({ spaceField }) => spaceField,
  );

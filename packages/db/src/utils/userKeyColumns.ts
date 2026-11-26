/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { MEMBER_MODELS, type MemberModel } from '@template/db/registries/memberModels';
import type { ModelName } from '@template/db/utils/modelNames';
import { relationsOfModel } from '@template/db/utils/prismaMapRelations';
import { uniq } from 'lodash-es';

export const userKeyColumns = (model: ModelName): string[] =>
  uniq(
    relationsOfModel(model).flatMap(({ targetModel, foreignKey }) => {
      if (!foreignKey) return [];
      if (typeof foreignKey === 'string') return targetModel === 'User' ? [foreignKey] : [];
      if (targetModel === 'User') return foreignKey.id ? [foreignKey.id] : [];
      if (MEMBER_MODELS.includes(targetModel as MemberModel))
        return foreignKey.userId ? [foreignKey.userId] : [];
      return [];
    }),
  );

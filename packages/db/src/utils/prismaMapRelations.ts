/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 */
import { type Identifier, relationsOf } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import {
  type AccessorName,
  type ModelName,
  toAccessor,
  toModelName,
} from '@template/db/utils/modelNames';

/** A model's relation, with the target's typed model name and accessor. */
export type ModelRelation = {
  /** The relation field's name on the model. */
  field: string;
  targetModel: ModelName;
  targetAccessor: AccessorName;
  foreignKey: Identifier | null;
  isRequired: boolean;
};

/** A model's relations as field-map's `relationsOf` lists them, with the target's PascalCase
 *  model name and camelCase accessor. */
export const relationsOfModel = (modelName: ModelName): ModelRelation[] =>
  relationsOf(prismaMap, modelName).map((relation) => ({
    field: relation.field,
    targetModel: toModelName(relation.targetModel),
    targetAccessor: toAccessor(relation.targetModel),
    foreignKey: relation.foreignKey,
    isRequired: relation.isRequired,
  }));

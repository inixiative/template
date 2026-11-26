/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { isScalarField, type ModelEntry, modelOf } from '@inixiative/field-map';
import { prismaMap } from '@template/db/generated/prismaMap';
import { partialUniquePredicates } from '@template/db/registries/partialUniquePredicates';
import type { ModelName } from '@template/db/utils/modelNames';

export type UniqueKeyOnColumn = {
  indexName: string;
  fields: readonly string[];
  predicate: Readonly<Record<string, unknown>>;
};

/** Each unique key of the model that includes the column (field-level `@unique` and `@@unique`), with the Prisma filter its partial index applies, empty when the index covers every row. */
export const uniqueKeysOnColumn = (model: ModelName, column: string): UniqueKeyOnColumn[] => {
  const entry: ModelEntry | undefined = modelOf(prismaMap, model);
  if (!entry) return [];
  const field = entry.fields[column];
  const fieldLevel: { fields: readonly string[]; name?: string }[] =
    field && isScalarField(field) && field.isUnique ? [{ fields: [column] }] : [];
  const indexLevel = (entry.indexes ?? []).filter(
    (index) => index.kind === 'unique' && index.fields.includes(column),
  );
  return [...fieldLevel, ...indexLevel].map(({ fields, name }) => {
    const indexName = name ?? `${model}_${fields.join('_')}_key`;
    return { indexName, fields, predicate: partialUniquePredicates[indexName] ?? {} };
  });
};

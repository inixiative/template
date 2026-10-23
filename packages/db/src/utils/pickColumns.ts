/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { hasColumn } from '@inixiative/prisma-map';
import { modelFields } from '@template/db/utils/fieldMetadata';
import { pickBy } from 'lodash-es';

export const pickColumns = <T extends Record<string, unknown>>(
  model: string,
  data: T,
): Partial<T> => {
  const fields = modelFields(model) ?? {};
  return pickBy(data, (_, key) => {
    const field = fields[key];
    return field !== undefined && hasColumn(field);
  }) as Partial<T>;
};

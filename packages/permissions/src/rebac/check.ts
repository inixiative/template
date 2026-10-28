/**
 * @atlas
 * @kind service
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { FieldMap } from '@inixiative/json-rules';
import { createRebacCheck, type SchemaMap } from '@inixiative/permissions';
import type { AccessorName, HydratedRecord } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import { PolymorphismRegistry } from '@template/db/registries/falsePolymorphism';
import type { Permix } from '@template/permissions/client';
import type { ActionRule, RebacSchema } from '@template/permissions/rebac/types';
import { lowerFirst } from 'lodash-es';

export const schemaMap: SchemaMap = {
  resources: Object.fromEntries(
    Object.keys(prismaMap.models).map((model) => [`db:${lowerFirst(model)}`, model]),
  ),
  fieldMap: prismaMap as unknown as FieldMap,
  polymorphism: PolymorphismRegistry,
};

const rebacCheck = createRebacCheck(schemaMap);

export const check = (
  permix: Permix,
  schema: RebacSchema,
  model: AccessorName,
  record: HydratedRecord,
  actionOrRule: ActionRule,
  data?: Record<string, HydratedRecord[]>,
  visited?: Set<string>,
): boolean =>
  rebacCheck(permix, schema, { resource: `db:${model}`, record, data }, actionOrRule, visited);

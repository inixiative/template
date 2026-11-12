/**
 * @atlas
 * @kind constant
 * @partOf primitive:authz, infrastructure:prisma
 * @uses none
 */
import type { FieldMap } from '@inixiative/json-rules';
import type { SchemaMap } from '@inixiative/permissions';
import { prismaMap } from '@template/db/generated/prismaMap';
import { PolymorphismRegistry } from '@template/db/registries/falsePolymorphism';
import { lowerFirst } from 'lodash-es';

export const schemaMap: SchemaMap = {
  resources: Object.fromEntries(
    Object.keys(prismaMap.models).map((model) => [`db:${lowerFirst(model)}`, model]),
  ),
  fieldMap: prismaMap as unknown as FieldMap,
  polymorphism: PolymorphismRegistry,
};

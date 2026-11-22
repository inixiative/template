/**
 * @atlas
 * @kind constant
 * @partOf primitive:authz, infrastructure:prisma
 * @uses none
 */
import { columnsOf, type FieldMap } from '@inixiative/field-map';
import type { SchemaMap } from '@inixiative/permissions';
import { prismaMap } from '@template/db/generated/prismaMap';
import { PolymorphismRegistry } from '@template/db/registries/falsePolymorphism';
import { sensitiveFieldsOf } from '@template/db/registries/sensitiveFields';
import { lowerFirst, omit, pick } from 'lodash-es';

export const ActorModel = { User: 'User', Token: 'Token' } as const;
export type ActorModel = (typeof ActorModel)[keyof typeof ActorModel];

const columnsARuleReadsOfActor = (model: ActorModel) => ({
  fields: omit(
    pick(prismaMap.models[model].fields, columnsOf(prismaMap, model)),
    sensitiveFieldsOf(model),
  ),
});

const actorMap: FieldMap = {
  models: {
    Acting: { fields: { model: { kind: 'enum', type: 'ActorModel' } } },
    User: columnsARuleReadsOfActor(ActorModel.User),
    Token: columnsARuleReadsOfActor(ActorModel.Token),
  },
  enums: { ...prismaMap.enums, ActorModel: Object.values(ActorModel) },
};

export const schemaMap: SchemaMap = {
  resources: Object.fromEntries(
    Object.keys(prismaMap.models).map((model) => [`db:${lowerFirst(model)}`, model]),
  ),
  fieldMap: prismaMap,
  polymorphism: PolymorphismRegistry,
  supplied: { maps: { actor: actorMap } },
};

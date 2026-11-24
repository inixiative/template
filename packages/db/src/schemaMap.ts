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
import { difference, pick } from 'lodash-es';

export const ActorModel = { User: 'User', Token: 'Token' } as const;
export type ActorModel = (typeof ActorModel)[keyof typeof ActorModel];

export const columnsARuleReadsOfActor = (model: ActorModel): string[] =>
  difference(columnsOf(prismaMap, model), sensitiveFieldsOf(model));

const actorModel = (model: ActorModel) => ({
  fields: pick(prismaMap.models[model].fields, columnsARuleReadsOfActor(model)),
});

const actorMap: FieldMap = {
  models: {
    Acting: { fields: { model: { kind: 'enum', type: 'ActorModel' } } },
    User: actorModel(ActorModel.User),
    Token: actorModel(ActorModel.Token),
  },
  enums: { ...prismaMap.enums, ActorModel: Object.values(ActorModel) },
};

// why: who is acting is given with each check, so every model of `db` reaches each actor model over a bridge with no join
export const schemaMapWithoutPermissions: Omit<SchemaMap, 'permissions'> = {
  fieldMaps: { db: prismaMap, actor: actorMap },
  polymorphismRegistries: { db: PolymorphismRegistry },
  bridges: Object.keys(actorMap.models).map((model) => ({
    endpoints: [{ fieldMap: 'db' }, { fieldMap: 'actor', model }],
    cardinality: 'oneToOne',
  })),
};

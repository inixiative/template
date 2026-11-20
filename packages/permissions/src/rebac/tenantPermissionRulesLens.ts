/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { type FieldMap, fieldAtPath } from '@inixiative/field-map';
import { createLens, type LensNarrowing, walkLensPath } from '@inixiative/json-rules';
import {
  type BindableOwnerModel,
  type ModelName,
  modelsHeldUnderTenant,
  toAccessor,
} from '@template/db';
import { EntitlementTargetModel } from '@template/db/generated/client/enums';
import { prismaMap } from '@template/db/generated/prismaMap';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { mapValues } from 'lodash-es';

const root = 'TenantPermissionRules';

/** The rebac schema as a field map: a resource is a model, an action a column, under one root with a relation per resource. */
const rebacSchemaAsFieldMap: FieldMap = {
  models: {
    [root]: {
      fields: mapValues(rebacSchema.permissions, (_, resource) => ({
        kind: 'object' as const,
        type: resource,
      })),
    },
    ...mapValues(rebacSchema.permissions, (permission) => ({
      fields: mapValues(permission?.actions, () => ({ kind: 'scalar' as const, type: 'Json' })),
    })),
  },
};

const everyResourceAndAction = createLens({
  maps: { rebac: rebacSchemaAsFieldMap },
  bridges: [],
  mapName: 'rebac',
  model: root,
});

const holdsEntitlements = (model: ModelName) => model in EntitlementTargetModel;
const isTenant = (model: ModelName) =>
  Boolean(fieldAtPath(prismaMap, model, 'tenantPermissionRules'));

/**
 * What a tenant of this kind may extend: the resources it can hold, never one that holds
 * entitlements (a token, an integration, a member row), and never `own` on a tenant below it.
 */
export const tenantPermissionRulesLens = (tenantModel: BindableOwnerModel): LensNarrowing => ({
  parent: everyResourceAndAction,
  root: {
    relations: Object.fromEntries(
      modelsHeldUnderTenant(tenantModel)
        .filter((model) => !holdsEntitlements(model))
        .filter((model) => `db:${toAccessor(model)}` in rebacSchema.permissions)
        .map((model) => [`db:${toAccessor(model)}`, isTenant(model) ? { omits: ['own'] } : {}]),
    ),
  },
});

export const tenantMayExtend = (lens: LensNarrowing, resource: string, action: string): boolean =>
  walkLensPath(lens, `${resource}.${action}`).outcome === 'resolved';

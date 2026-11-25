/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { FieldMap } from '@inixiative/field-map';
import { createLens, type LensNarrowing, lensVisit } from '@inixiative/json-rules';
import type { BindableOwnerModel } from '@template/db/registries/polymorphicAxisPointsAt';
import { type ModelName, resourceOfModel } from '@template/db/utils/modelNames';
import { modelsHeldUnderTenant } from '@template/db/utils/tenantRowsAbove';
import { schemaMap } from '@template/permissions/rebac/schema';
import { mapValues, memoize } from 'lodash-es';

const root = 'TenantPermissionRules';

/** The rebac schema as a field map: a resource is a model, an action a column, under one root with a relation per resource. */
const rebacSchemaAsFieldMap: FieldMap = {
  models: {
    [root]: {
      fields: mapValues(schemaMap.permissions, (_, resource) => ({
        kind: 'object' as const,
        type: resource,
      })),
    },
    ...mapValues(schemaMap.permissions, (permission) => ({
      fields: mapValues(permission?.actions, () => ({ kind: 'scalar' as const, type: 'Boolean' })),
    })),
  },
};

const everyResourceAndAction = createLens({
  maps: { rebac: rebacSchemaAsFieldMap },
  bridges: [],
  mapName: 'rebac',
  model: root,
});

/**
 * The resources a tenant may extend, each with its narrowing: product records, never `own`, and
 * reading or operating a space, and reading an inquiry. Never the rest of the permission system's
 * own (a member row, a token, an integration, a sign-in provider), nor sending or resolving an
 * inquiry: an action there is a gate on handing authority on, and a rule on it would open that gate.
 */
const resourcesATenantMayExtend: Partial<
  Record<ModelName, { picks?: string[]; omits?: string[] }>
> = {
  Artifact: { omits: ['own', 'delete'] },
  Contact: { omits: ['own'] },
  Segment: { omits: ['own'] },
  // why: an organization opens its spaces to read or operate; `manage` is what minting a space's
  // tokens, writing its members' roles and creating its integrations ask
  Space: { picks: ['read', 'operate'] },
  Inquiry: { picks: ['read'] },

  // ========================================================================
  // TEMPLATE ABOVE — Add app-specific product resources below
  // ========================================================================
};

/** What a tenant of this kind may extend: the listed resources it can hold. */
export const tenantPermissionRulesLens = (tenantModel: BindableOwnerModel): LensNarrowing => ({
  parent: everyResourceAndAction,
  root: {
    relations: Object.fromEntries(
      modelsHeldUnderTenant(tenantModel).flatMap((model) => {
        const narrowing = resourcesATenantMayExtend[model];
        return narrowing ? [[resourceOfModel(model), narrowing]] : [];
      }),
    ),
  },
});

/** The actions of a resource a tenant of this kind may extend, as its lens shows them. */
export const actionsTenantMayExtend = memoize(
  (tenantModel: BindableOwnerModel, resource: string): string[] =>
    Object.keys(lensVisit(tenantPermissionRulesLens(tenantModel), resource)?.fields ?? {}),
  (tenantModel, resource) => `${tenantModel} ${resource}`,
);

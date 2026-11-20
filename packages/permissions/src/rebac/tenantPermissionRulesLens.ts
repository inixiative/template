/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { FieldMap } from '@inixiative/field-map';
import { createLens, type LensNarrowing, walkLensPath } from '@inixiative/json-rules';
import {
  type BindableOwnerModel,
  type ModelName,
  modelsHeldUnderTenant,
  toAccessor,
} from '@template/db';
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
 * The resources a tenant may extend: product records only. Never the permission system's own
 * (a tenant, a member row, a token, an integration, an inquiry, a sign-in provider): an action
 * there is a gate on handing authority on, and a rule on it would open that gate.
 */
const resourcesATenantMayExtend: ModelName[] = [
  'Contact',
  'Segment',

  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific product resources below
  // ==========================================================================
];

/** What a tenant of this kind may extend: the listed resources it can hold, never `own`. */
export const tenantPermissionRulesLens = (tenantModel: BindableOwnerModel): LensNarrowing => ({
  parent: everyResourceAndAction,
  root: {
    relations: Object.fromEntries(
      modelsHeldUnderTenant(tenantModel)
        .filter((model) => resourcesATenantMayExtend.includes(model))
        .map((model) => [`db:${toAccessor(model)}`, { omits: ['own'] }]),
    ),
  },
});

export const tenantMayExtend = (lens: LensNarrowing, resource: string, action: string): boolean => {
  const walk = walkLensPath(lens, `${resource}.${action}`);
  return walk.outcome === 'resolved' && walk.terminal.entry.kind === 'scalar';
};

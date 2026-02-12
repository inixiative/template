import type { ModelName } from '@template/db/utils/modelNames';

// ============================================================================
// POLYMORPHISM REGISTRY - Single source of truth for false polymorphism
// ============================================================================
// Used by:
// - DB constraints (packages/db/src/constraints/polymorphic.ts)
// - Validation hooks (apps/api/src/hooks/falsePolymorphism/)
// - Immutable fields (type fields are immutable)

// Special non-model values for ownership
type SpecialOwner = 'default' | 'admin';

// Valid type values in polymorphic fields (strongly typed)
export type PolymorphicValue = ModelName | SpecialOwner;

export type PolymorphicAxis = {
  field: string; // e.g., 'customerModel', 'ownerModel'
  fkMap: Partial<Record<PolymorphicValue, string[]>>; // typeValue → required FK fields
};

export type PolymorphicConfig = {
  axes: PolymorphicAxis[];
  // If multiple axes, which combinations are valid (axis0Value → allowed axis1Values)
  // Only needed when there are restrictions
  allowedCombinations?: Partial<Record<PolymorphicValue, PolymorphicValue[]>>;
};

// ============================================================================
// FLEXIBLE REFERENCES - Can reference models directly or via false polymorphism
// ============================================================================

// Reference to a model via its false polymorphic relationship
export type FalsePolymorphismRef = {
  model: ModelName; // The polymorphic model (e.g., CustomerRef)
  axis: string; // Which axis (e.g., customerModel, providerModel)
  value: PolymorphicValue; // The type value (e.g., User, Organization, Space)
};

// Flexible reference: either a direct model name or a false polymorphism reference
export type FlexibleRef = ModelName | FalsePolymorphismRef;

// Type guard
export const isFalsePolymorphismRef = (ref: FlexibleRef): ref is FalsePolymorphismRef =>
  typeof ref === 'object' && 'model' in ref;

// Resolve FalsePolymorphismRef to FK field using the registry
export const resolveFalsePolymorphismRef = (ref: FalsePolymorphismRef): string | null => {
  const config = PolymorphismRegistry[ref.model];
  if (!config) return null;

  const axis = config.axes.find((a) => a.field === ref.axis);
  if (!axis) return null;

  const fkFields = axis.fkMap[ref.value];
  // Return the first FK field (usually there's just one per type)
  return fkFields?.[0] ?? null;
};

export const PolymorphismRegistry: Partial<Record<ModelName, PolymorphicConfig>> = {
  Token: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          User: ['userId'],
          Organization: ['organizationId'],
          OrganizationUser: ['organizationId', 'userId'],
          Space: ['organizationId', 'spaceId'],
          SpaceUser: ['organizationId', 'spaceId', 'userId'],
        },
      },
    ],
  },

  WebhookSubscription: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          User: ['userId'],
          Organization: ['organizationId'],
          Space: ['spaceId'],
        },
      },
      {
        field: 'model',
        fkMap: {
          CustomerRef: [],
        },
      },
    ],
    // All owner types can subscribe to CustomerRef
    allowedCombinations: {
      User: ['CustomerRef'],
      Organization: ['CustomerRef'],
      Space: ['CustomerRef'],
    },
  },

  CustomerRef: {
    axes: [
      {
        field: 'customerModel',
        fkMap: {
          User: ['customerUserId'],
          Organization: ['customerOrganizationId'],
          Space: ['customerSpaceId'],
        },
      },
      {
        field: 'providerModel',
        fkMap: {
          Space: ['providerSpaceId'],
        },
      },
    ],
    allowedCombinations: {
      User: ['Space'],
      Organization: ['Space'],
      Space: ['Space'],
    },
  },

  Inquiry: {
    axes: [
      {
        field: 'sourceModel',
        fkMap: {
          admin: [],
          User: ['sourceUserId'],
          Organization: ['sourceOrganizationId'],
          Space: ['sourceSpaceId'],
        },
      },
      {
        field: 'targetModel',
        fkMap: {
          admin: [],
          User: ['targetUserId'],
          Organization: ['targetOrganizationId'],
          Space: ['targetSpaceId'],
        },
      },
    ],
  },

  EmailComponent: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          default: [],
          admin: [],
          Organization: ['organizationId'],
          Space: ['organizationId', 'spaceId'],
        },
      },
    ],
  },

  EmailTemplate: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          default: [],
          admin: [],
          Organization: ['organizationId'],
          Space: ['organizationId', 'spaceId'],
        },
      },
    ],
  },
};

// Helper to get config for a model
export const getPolymorphismConfig = (model: ModelName): PolymorphicConfig | null =>
  PolymorphismRegistry[model] ?? null;

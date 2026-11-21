/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { ModelName } from '@template/db/utils/modelNames';

// ============================================================================
// POLYMORPHISM REGISTRY - Single source of truth for false polymorphism
// ============================================================================
// Used by:
// - DB constraints (packages/db/src/constraints/polymorphic.ts)
// - Validation hooks (apps/api/src/hooks/falsePolymorphism/)
// - Immutable fields (type fields are immutable)

// Special non-model values for ownership
type SpecialOwner = 'default' | 'admin' | 'platform';

// Valid type values in polymorphic fields (strongly typed)
export type PolymorphicValue = ModelName | SpecialOwner;

export type PolymorphicAxis = {
  field: string; // e.g., 'customerModel', 'ownerModel'
  fkMap: Partial<Record<PolymorphicValue, readonly string[]>>; // typeValue → required FK fields
  dualPolymorphismId?: string; // the plain column holding the one id the set typed FK points at
  carriesOwnerKeysOf?: readonly ModelName[];
};

export type PolymorphicConfig = {
  axes: readonly PolymorphicAxis[];
};

// ============================================================================
// FLEXIBLE REFERENCES - Can reference models directly or via false polymorphism
// ============================================================================

// Reference to a model via its false polymorphic relationship
export type FalsePolymorphismRef = {
  model: ModelName; // The polymorphic model (e.g., CustomerRelationship)
  axis: string; // Which axis (e.g., customerModel, providerModel)
  value: string; // The type value (e.g., User, Organization, Space)
};

// Flexible reference: either a direct model name or a false polymorphism reference
export type FlexibleRef = ModelName | FalsePolymorphismRef;

// Type guard
export const isFalsePolymorphismRef = (ref: FlexibleRef): ref is FalsePolymorphismRef =>
  typeof ref === 'object' && 'model' in ref;

export const PolymorphismRegistry = {
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
          Integration: ['integrationId'],
        },
        carriesOwnerKeysOf: ['Integration'],
      },
    ],
  },

  Contact: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          User: ['userId'],
          Organization: ['organizationId'],
          Space: ['spaceId'],
        },
      },
    ],
  },

  Integration: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          User: ['userId'],
          OrganizationUser: ['organizationId', 'userId'],
          Organization: ['organizationId'],
          Space: ['organizationId', 'spaceId'],
          SpaceUser: ['organizationId', 'spaceId', 'userId'],
        },
      },
    ],
  },

  TagAttachment: {
    axes: [
      {
        field: 'resourceModel',
        fkMap: {
          User: ['resourceUserId'],
          Organization: ['resourceOrganizationId'],
          Space: ['resourceSpaceId'],
          Project: ['resourceProjectId'],
        },
      },
    ],
  },

  Project: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          User: ['userId'],
          OrganizationUser: ['organizationId', 'userId'],
          Organization: ['organizationId'],
          Space: ['organizationId', 'spaceId'],
          SpaceUser: ['organizationId', 'spaceId', 'userId'],
        },
      },
    ],
  },

  Tag: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          platform: [],
          User: ['userId'],
          Organization: ['organizationId'],
          Space: ['spaceId'],
        },
      },
    ],
  },

  TagCategory: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          platform: [],
          User: ['userId'],
          Organization: ['organizationId'],
          Space: ['spaceId'],
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
    ],
  },

  CustomerRelationship: {
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
          User: ['providerUserId'],
          Organization: ['providerOrganizationId'],
          Space: ['providerSpaceId'],
        },
      },
    ],
  },

  RuleReference: {
    axes: [
      {
        field: 'sourceModel',
        dualPolymorphismId: 'sourceId',
        fkMap: {
          EmailTemplate: ['sourceEmailTemplateId'],
          EmailComponent: ['sourceEmailComponentId'],
          Segment: ['sourceSegmentId'],
          Entitlement: ['sourceEntitlementId'],
        },
      },
      {
        field: 'targetModel',
        dualPolymorphismId: 'targetId',
        fkMap: {
          Tag: ['targetTagId'],
          Organization: ['targetOrganizationId'],
          Space: ['targetSpaceId'],
          Segment: ['targetSegmentId'],
          User: ['targetUserId'],
          OrganizationUser: ['targetOrganizationUserId'],
          SpaceUser: ['targetSpaceUserId'],
          Integration: ['targetIntegrationId'],
          Project: ['targetProjectId'],
          Token: ['targetTokenId'],
          Contact: ['targetContactId'],
          SegmentMember: ['targetSegmentMemberId'],
          Inquiry: ['targetInquiryId'],
          Flow: ['targetFlowId'],
          AuthProvider: ['targetAuthProviderId'],
          WebhookSubscription: ['targetWebhookSubscriptionId'],
          Setting: ['targetSettingId'],
        },
      },
    ],
  },

  Entitlement: {
    axes: [
      {
        field: 'sourceModel',
        dualPolymorphismId: 'sourceId',
        fkMap: {
          User: ['sourceUserId'],
          Organization: ['sourceOrganizationId'],
          OrganizationUser: ['sourceOrganizationId', 'sourceUserId'],
          Space: ['sourceSpaceId'],
          SpaceUser: ['sourceOrganizationId', 'sourceSpaceId', 'sourceUserId'],
          Integration: ['sourceIntegrationId'],
          Project: ['sourceProjectId'],
          Token: ['sourceTokenId'],
          Contact: ['sourceContactId'],
          Segment: ['sourceSegmentId'],
          SegmentMember: ['sourceSegmentMemberId'],
          Inquiry: ['sourceInquiryId'],
          Flow: ['sourceFlowId'],
          AuthProvider: ['sourceAuthProviderId'],
          WebhookSubscription: ['sourceWebhookSubscriptionId'],
          Setting: ['sourceSettingId'],
        },
      },
      {
        field: 'targetModel',
        dualPolymorphismId: 'targetId',
        fkMap: {
          Token: ['targetTokenId'],
          Integration: ['targetIntegrationId'],
          OrganizationUser: ['targetOrganizationId', 'targetUserId'],
          SpaceUser: ['targetOrganizationId', 'targetSpaceId', 'targetUserId'],
        },
      },
    ],
  },

  Inquiry: {
    axes: [
      {
        field: 'sourceModel',
        dualPolymorphismId: 'sourceId',
        fkMap: {
          admin: [],
          User: ['sourceUserId'],
          OrganizationUser: ['sourceOrganizationId', 'sourceUserId'],
          Organization: ['sourceOrganizationId'],
          Space: ['sourceOrganizationId', 'sourceSpaceId'],
          SpaceUser: ['sourceOrganizationId', 'sourceSpaceId', 'sourceUserId'],
          Integration: ['sourceIntegrationId'],
          Token: ['sourceTokenId'],
          Project: ['sourceProjectId'],
        },
        carriesOwnerKeysOf: ['Integration', 'Token', 'Project'],
      },
      {
        field: 'targetModel',
        dualPolymorphismId: 'targetId',
        fkMap: {
          admin: [],
          User: ['targetUserId'],
          OrganizationUser: ['targetOrganizationId', 'targetUserId'],
          Organization: ['targetOrganizationId'],
          Space: ['targetOrganizationId', 'targetSpaceId'],
          SpaceUser: ['targetOrganizationId', 'targetSpaceId', 'targetUserId'],
          Integration: ['targetIntegrationId'],
          Token: ['targetTokenId'],
          Project: ['targetProjectId'],
        },
        carriesOwnerKeysOf: ['Integration', 'Token', 'Project'],
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
          User: ['userId'],
          OrganizationUser: ['organizationId', 'userId'],
          SpaceUser: ['organizationId', 'spaceId', 'userId'],
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
          User: ['userId'],
          OrganizationUser: ['organizationId', 'userId'],
          SpaceUser: ['organizationId', 'spaceId', 'userId'],
        },
      },
    ],
  },

  AuditLog: {
    axes: [
      {
        field: 'subjectModel',
        dualPolymorphismId: 'subjectId',
        fkMap: {
          User: ['subjectUserId'],
          Organization: ['subjectOrganizationId'],
          OrganizationUser: ['subjectOrganizationId', 'subjectUserId'],
          Space: ['subjectSpaceId'],
          SpaceUser: ['subjectOrganizationId', 'subjectSpaceId', 'subjectUserId'],
          Token: ['subjectTokenId'],
          AuthProvider: ['subjectAuthProviderId'],
          Inquiry: ['subjectInquiryId'],
          Account: ['subjectAccountId'],
          Session: ['subjectSessionId'],
          Verification: ['subjectVerificationId'],
          CronJob: ['subjectCronJobId'],
          EmailTemplate: ['subjectEmailTemplateId'],
          EmailComponent: ['subjectEmailComponentId'],
          CustomerRelationship: ['subjectCustomerRelationshipId'],
          Integration: ['subjectIntegrationId'],
          Segment: ['subjectSegmentId'],
          Entitlement: ['subjectEntitlementId'],
          Setting: ['subjectSettingId'],
        },
      },
    ],
  },

  Setting: {
    axes: [
      {
        field: 'resourceModel',
        dualPolymorphismId: 'resourceId',
        fkMap: {
          User: ['resourceUserId'],
          Organization: ['resourceOrganizationId'],
          OrganizationUser: ['resourceOrganizationId', 'resourceUserId'],
          Space: ['resourceOrganizationId', 'resourceSpaceId'],
          SpaceUser: ['resourceOrganizationId', 'resourceSpaceId', 'resourceUserId'],
          Project: ['resourceProjectId'],
        },
      },
    ],
  },

  Segment: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          User: ['userId'],
          Organization: ['organizationId'],
          Space: ['spaceId'],
        },
      },
    ],
  },

  IntegrationRecord: {
    axes: [
      {
        field: 'recordModel',
        fkMap: {
          CustomerRelationship: ['recordCustomerRelationshipId'],
        },
      },
    ],
  },

  CommunicationLog: {
    axes: [
      {
        field: 'senderModel',
        fkMap: {
          platform: [],
          admin: [],
          User: ['senderUserId'],
          Organization: ['senderOrganizationId'],
          Space: ['senderOrganizationId', 'senderSpaceId'],
          OrganizationUser: ['senderOrganizationId', 'senderUserId'],
          SpaceUser: ['senderOrganizationId', 'senderSpaceId', 'senderUserId'],
        },
      },
    ],
  },
} as const satisfies Partial<Record<ModelName, PolymorphicConfig>>;

const polymorphicConfigs: Partial<Record<ModelName, PolymorphicConfig>> = PolymorphismRegistry;

// Helper to get config for a model
export const polymorphismConfigForModel = (model: ModelName): PolymorphicConfig | null =>
  polymorphicConfigs[model] ?? null;

export const polymorphicAxis = (model: ModelName, axisField: string): PolymorphicAxis => {
  const axis = polymorphismConfigForModel(model)?.axes.find(
    (candidate) => candidate.field === axisField,
  );
  if (!axis) throw new Error(`${model} has no false-polymorphic axis ${axisField}`);
  return axis;
};

/** Every key column a side uses, across all its values, once each. */
export const sideKeyColumns = (axis: PolymorphicAxis): string[] => [
  ...new Set(Object.values(axis.fkMap).flatMap((keys) => [...(keys ?? [])])),
];

/** Every key column of a side, null: the base a writer sets one value's keys over. */
export const emptySideKeyColumns = (axis: PolymorphicAxis): Record<string, null> =>
  Object.fromEntries(sideKeyColumns(axis).map((column) => [column, null]));

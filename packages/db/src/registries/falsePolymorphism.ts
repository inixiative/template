import type { ModelName } from '../utils/modelNames';

export type FalsePolymorphismRelation = {
  typeField: string;
  fkMap: Record<string, string[]>; // typeValue -> required FK fields
};

/**
 * Single source of truth for false polymorphism configurations.
 * Used by:
 * - DB constraints (packages/db/src/constraints/polymorphic.ts)
 * - Validation hooks (apps/api/src/hooks/falsePolymorphism/)
 * - Immutable fields (type fields are immutable)
 */
export const FalsePolymorphismRegistry: Partial<Record<ModelName, FalsePolymorphismRelation[]>> = {
  Token: [
    {
      typeField: 'ownerModel',
      fkMap: {
        User: ['userId'],
        Organization: ['organizationId'],
        OrganizationUser: ['organizationId', 'userId'],
      },
    },
  ],
  WebhookSubscription: [
    {
      typeField: 'ownerModel',
      fkMap: {
        User: ['userId'],
        Organization: ['organizationId'],
      },
    },
  ],
  Inquiry: [
    {
      typeField: 'sourceModel',
      fkMap: {
        User: ['sourceUserId'],
        Organization: ['sourceOrganizationId'],
      },
    },
    {
      typeField: 'targetModel',
      fkMap: {
        User: ['targetUserId'],
        Organization: ['targetOrganizationId'],
      },
    },
  ],
};

export const getPolymorphismConfigs = (model: ModelName): FalsePolymorphismRelation[] =>
  FalsePolymorphismRegistry[model] ?? [];

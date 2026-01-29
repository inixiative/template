import type { ModelName } from '@template/db';

export type FalsePolymorphismRelation = {
  typeField: string;
  fkMap: Record<string, string[]>; // typeValue -> required FK fields
};

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
        Admin: [],
      },
    },
    {
      typeField: 'targetModel',
      fkMap: {
        User: ['targetUserId'],
        Organization: ['targetOrganizationId'],
        Admin: [],
      },
    },
  ],
};

export const getPolymorphismConfigs = (model: ModelName): FalsePolymorphismRelation[] =>
  FalsePolymorphismRegistry[model] ?? [];

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
};

export const getPolymorphismConfigs = (model: ModelName): FalsePolymorphismRelation[] =>
  FalsePolymorphismRegistry[model] ?? [];

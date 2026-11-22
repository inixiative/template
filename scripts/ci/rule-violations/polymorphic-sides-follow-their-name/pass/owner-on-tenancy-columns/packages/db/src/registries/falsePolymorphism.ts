export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          Organization: ['organizationId'],
          Space: ['organizationId', 'spaceId'],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

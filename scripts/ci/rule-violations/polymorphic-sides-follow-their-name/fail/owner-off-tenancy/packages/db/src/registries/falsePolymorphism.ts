export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'ownerModel',
        fkMap: {
          User: ['ownerUserId'],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

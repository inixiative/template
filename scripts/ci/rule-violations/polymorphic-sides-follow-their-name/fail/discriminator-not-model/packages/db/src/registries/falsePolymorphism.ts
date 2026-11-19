export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'model',
        fkMap: {
          User: ['userId'],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

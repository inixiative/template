export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'subjectModel',
        fkMap: {
          User: ['userId'],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

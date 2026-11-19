export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'subjectModel',
        fkMap: {
          User: [],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

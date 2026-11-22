export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'subjectModel',
        dualPolymorphismId: 'subjectId',
        fkMap: {
          User: ['subjectUserId'],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

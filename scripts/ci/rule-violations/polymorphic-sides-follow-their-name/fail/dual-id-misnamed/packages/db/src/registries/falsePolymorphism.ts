export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'subjectModel',
        dualPolymorphismId: 'targetId',
        fkMap: {
          User: ['subjectUserId'],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'subjectModel',
        fkMap: {
          User: ['subjectUserId'],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

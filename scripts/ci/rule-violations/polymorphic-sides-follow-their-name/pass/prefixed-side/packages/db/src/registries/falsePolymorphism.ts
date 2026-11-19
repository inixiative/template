export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'subjectModel',
        fkMap: {
          admin: [],
          User: ['subjectUserId'],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

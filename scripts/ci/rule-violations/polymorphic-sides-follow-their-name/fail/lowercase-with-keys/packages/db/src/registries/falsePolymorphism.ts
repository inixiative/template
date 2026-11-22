export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'subjectModel',
        fkMap: {
          admin: ['subjectUserId'],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

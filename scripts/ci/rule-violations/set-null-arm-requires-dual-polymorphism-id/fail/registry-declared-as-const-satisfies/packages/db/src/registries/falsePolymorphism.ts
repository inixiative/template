export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'subjectModel',
        fkMap: {
          User: ['subjectUserId'],
          Flow: ['subjectFlowId'],
        },
      },
    ],
  },
} as const satisfies Record<string, unknown>;

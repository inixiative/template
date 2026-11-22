export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'subjectModel',
        dualPolymorphismId: 'subjectId',
        fkMap: {
          User: ['subjectUserId'],
          Flow: ['subjectFlowId'],
        },
      },
    ],
  },
};

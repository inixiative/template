export const PolymorphismRegistry = {
  Mention: {
    axes: [
      {
        field: 'subjectModel',
        materialized: 'subjectId',
        fkMap: {
          User: ['subjectUserId'],
          Flow: ['subjectFlowId'],
        },
      },
    ],
  },
};

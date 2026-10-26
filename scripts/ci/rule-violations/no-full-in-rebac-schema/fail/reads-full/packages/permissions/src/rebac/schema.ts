export const schema = {
  'db:token': { actions: { create: { rule: { field: 'full', operator: 'equals', value: true } } } },
};

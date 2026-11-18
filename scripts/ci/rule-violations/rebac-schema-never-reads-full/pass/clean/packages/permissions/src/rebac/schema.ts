export const schema = {
  'db:token': { actions: { create: { rule: { field: 'role', operator: 'in', value: ['owner'] } } } },
};

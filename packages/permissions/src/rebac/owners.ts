import type { ActionRule, ModelPermission } from '@template/permissions/rebac/types';

// Spreadable rebac action block for owner-polymorphic models. The model has
// nullable FKs to one or more owner relations (default: user / organization /
// space). For each action, OR over the owner relations — only the populated
// FK resolves; the others' rel returns false (no record found).
//
// Usage:
//   contact: { actions: ownerActions() }
//   emailTemplate: { actions: ownerActions(['organization', 'space']) }
//   contact: { actions: { ...ownerActions(), customAction: { ... } } }
export const ownerActions = (
  rels: readonly string[] = ['user', 'organization', 'space'],
): ModelPermission['actions'] => {
  const fanout = (action: string): ActionRule => ({
    any: rels.map((rel) => ({ rel, action })),
  });
  return {
    own: fanout('own'),
    manage: fanout('manage'),
    operate: 'manage',
    read: fanout('read'),
  };
};

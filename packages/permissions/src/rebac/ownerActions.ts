/**
 * @atlas
 * @kind constructor
 * @constructs rebacActions
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';
import { mapValues } from 'lodash-es';

// Spreadable rebac action block for owner-polymorphic models. The model has
// nullable FKs to one or more owner relations (default: user / organization /
// space). For each action, OR over the owner relations — only the populated
// FK resolves; the others' rel returns false (no record found).
//
// Each action delegates to the SAME action on the owner — the read =>
// operate => manage => own chain lives on the owner side (User/Org/Space)
// and is reused as-is.
//
// Usage:
//   contact: { actions: ownerActions() }
//   emailTemplate: { actions: ownerActions(['organization', 'space']) }
//   contact: { actions: { ...ownerActions(), customAction: { ... } } }
export const ownerActions = (
  rels: readonly string[] = ['user', 'organization', 'space'],
): ResourcePermission['actions'] => {
  const fanout = (action: string): ActionRule => ({
    any: rels.map((rel) => ({ rel, action })),
  });
  return {
    own: fanout('own'),
    manage: fanout('manage'),
    operate: fanout('operate'),
    read: fanout('read'),
  };
};

// why: a member's row (userId and organizationId both set) is reached by the member or a tenant owner, never an admin.
export const membershipOwnerActions = (): ResourcePermission['actions'] => {
  const reach = (action: string): ActionRule => ({
    any: [
      { rel: 'user', action },
      {
        all: [
          { rule: { field: 'userId', operator: Operator.notExists } },
          {
            any: [
              { rel: 'organization', action },
              { rel: 'space', action },
            ],
          },
        ],
      },
      {
        all: [
          { rule: { field: 'userId', operator: Operator.exists } },
          {
            any: [
              { rel: 'organization', action: 'own' },
              { rel: 'space', action: 'own' },
              {
                all: [
                  { rule: { field: 'spaceId', operator: Operator.notExists } },
                  { rel: 'organizationUser', action: `membership.${action}` },
                ],
              },
              {
                all: [
                  { rule: { field: 'spaceId', operator: Operator.exists } },
                  { rel: 'spaceUser', action: `membership.${action}` },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  return {
    own: reach('own'),
    manage: reach('manage'),
    operate: reach('operate'),
    read: reach('read'),
  };
};

// why: a fence ANDs onto the owner reach; superadmin and a direct permix grant on db:integration skip it
export const integrationReach: ActionRule = {
  any: [
    { actor: { field: 'integrationReach', operator: Operator.equals, value: 'all' } },
    { rule: { field: 'id', operator: Operator.in, bind: 'actor.integrationIds' } },
  ],
};

export const integrationActions = (): ResourcePermission['actions'] =>
  mapValues(membershipOwnerActions(), (rule) => ({ all: [rule, integrationReach] }));

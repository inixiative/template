/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';

export const highRoles = ['owner', 'admin'];
export const actorIsUser: ActionRule = {
  rule: { field: '__actor.model', operator: Operator.equals, value: 'User' },
};

export const actorIsDelegateOfUser: ActionRule = {
  rule: { field: '__actor.record.ownerModel', operator: Operator.equals, value: 'User' },
};

export const ownerRelations = [
  ['User', 'user'],
  ['Organization', 'organization'],
  ['OrganizationUser', 'organizationUser'],
  ['Space', 'space'],
  ['SpaceUser', 'spaceUser'],
  ['Integration', 'integration'],
] as const;

export const actionOnOwner = (action: string, at = ''): ActionRule => ({
  any: ownerRelations.map(([ownerModel, rel]) => ({
    all: [
      { rule: { field: `${at}ownerModel`, operator: Operator.equals, value: ownerModel } },
      { rel: `${at}${rel}`, action },
    ],
  })),
});

export const actorIsItsUser = (at = ''): ActionRule => ({
  all: [
    { rule: { field: `${at}userId`, operator: Operator.notEmpty, value: true } },
    {
      any: [
        {
          all: [
            actorIsUser,
            {
              rule: { field: `${at}userId`, operator: Operator.equals, path: '__actor.record.id' },
            },
          ],
        },
        {
          all: [
            actorIsDelegateOfUser,
            {
              rule: {
                field: `${at}userId`,
                operator: Operator.equals,
                path: '__actor.record.userId',
              },
            },
          ],
        },
      ],
    },
    { rel: `${at}user`, action: 'manage' },
  ],
});

export const ownedByOrganizationOrSpace = (at = ''): ActionRule => ({
  rule: { field: `${at}ownerModel`, operator: Operator.in, value: ['Organization', 'Space'] },
});

export const ownedByIntegration: ActionRule = {
  rule: { field: 'ownerModel', operator: Operator.equals, value: 'Integration' },
};

export const notOwnedByIntegration: ActionRule = {
  rule: { field: 'ownerModel', operator: Operator.notEquals, value: 'Integration' },
};

export const roleIsHigh: ActionRule = {
  rule: { field: 'role', operator: Operator.in, value: highRoles },
};

export const assignRole = (own: ActionRule, manage: ActionRule): ActionRule => ({
  any: [
    { all: [roleIsHigh, own] },
    {
      all: [
        { rule: { field: 'role', operator: Operator.in, value: ['member', 'viewer'] } },
        manage,
      ],
    },
  ],
});

export const roleHeldAtOwner = (at = ''): ActionRule => ({
  any: [
    {
      all: [
        { rule: { field: 'role', operator: Operator.equals, value: null } },
        actionOnOwner('read', at),
      ],
    },
    ...roleHierarchy.map((role) => ({
      all: [
        { rule: { field: 'role', operator: Operator.equals, value: role } },
        actionOnOwner(roleToStandardAction(role), at),
      ],
    })),
  ],
});

export const ownedByYouOrOrganizationOrSpace = (at = ''): ActionRule => ({
  any: [ownedByOrganizationOrSpace(at), actorIsItsUser(at)],
});

export const ownedByMember: ActionRule = {
  rule: { field: 'ownerModel', operator: Operator.in, value: ['OrganizationUser', 'SpaceUser'] },
};

export const ownedByUser: ActionRule = {
  rule: { field: 'ownerModel', operator: Operator.equals, value: 'User' },
};

export const integrationAdministering = {
  create: {
    any: [
      { all: [ownedByUser, { rel: 'user', action: 'operate' }] },
      { all: [ownedByOrganizationOrSpace(), actionOnOwner('manage')] },
      { all: [ownedByMember, actorIsItsUser()] },
    ],
  },
  own: { any: [actorIsItsUser(), { all: [ownedByOrganizationOrSpace(), actionOnOwner('own')] }] },
  manage: {
    any: [actorIsItsUser(), { all: [ownedByOrganizationOrSpace(), actionOnOwner('manage')] }],
  },
} satisfies Record<string, ActionRule>;

export const integrationAccess = {
  operate: actionOnOwner('operate'),
  read: actionOnOwner('read'),
  assign: {
    any: [
      {
        all: [
          ownedByOrganizationOrSpace(),
          assignRole(actionOnOwner('own'), actionOnOwner('manage')),
        ],
      },
      { all: [actorIsItsUser(), roleHeldAtOwner()] },
    ],
  },
} satisfies Record<string, ActionRule>;

export const tokenAccessIsYours: ActionRule = {
  any: [
    { all: [notOwnedByIntegration, roleHeldAtOwner(), ownedByYouOrOrganizationOrSpace()] },
    {
      all: [
        ownedByIntegration,
        roleHeldAtOwner('integration.'),
        ownedByYouOrOrganizationOrSpace('integration.'),
      ],
    },
  ],
};

export const managedUpTheChain: ActionRule = {
  any: [
    { all: [notOwnedByIntegration, actionOnOwner('manage')] },
    { all: [ownedByIntegration, actionOnOwner('manage', 'integration.')] },
  ],
};

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

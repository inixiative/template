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

export const owners = [
  ['User', 'user'],
  ['Organization', 'organization'],
  ['OrganizationUser', 'organizationUser'],
  ['Space', 'space'],
  ['SpaceUser', 'spaceUser'],
  ['Integration', 'integration'],
] as const;

export const onOwner = (action: string, at = ''): ActionRule => ({
  any: owners.map(([ownerModel, rel]) => ({
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

export const highRole: ActionRule = {
  rule: { field: 'role', operator: Operator.in, value: highRoles },
};

export const assignRole = (own: ActionRule, manage: ActionRule): ActionRule => ({
  any: [
    { all: [highRole, own] },
    {
      all: [
        { rule: { field: 'role', operator: Operator.in, value: ['member', 'viewer'] } },
        manage,
      ],
    },
  ],
});

export const heldAtOwner = (at = ''): ActionRule => ({
  any: [
    {
      all: [
        { rule: { field: 'role', operator: Operator.equals, value: null } },
        onOwner('read', at),
      ],
    },
    ...roleHierarchy.map((role) => ({
      all: [
        { rule: { field: 'role', operator: Operator.equals, value: role } },
        onOwner(roleToStandardAction(role), at),
      ],
    })),
  ],
});

export const yoursOrOrganizationOrSpace = (at = ''): ActionRule => ({
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
      { all: [ownedByOrganizationOrSpace(), onOwner('manage')] },
      { all: [ownedByMember, actorIsItsUser()] },
    ],
  },
  own: { any: [actorIsItsUser(), { all: [ownedByOrganizationOrSpace(), onOwner('own')] }] },
  manage: {
    any: [actorIsItsUser(), { all: [ownedByOrganizationOrSpace(), onOwner('manage')] }],
  },
} satisfies Record<string, ActionRule>;

export const integrationAccess = {
  operate: onOwner('operate'),
  read: onOwner('read'),
  assign: {
    any: [
      { all: [ownedByOrganizationOrSpace(), assignRole(onOwner('own'), onOwner('manage'))] },
      { all: [actorIsItsUser(), heldAtOwner()] },
    ],
  },
} satisfies Record<string, ActionRule>;

export const tokenAccessIsYours: ActionRule = {
  any: [
    { all: [notOwnedByIntegration, heldAtOwner(), yoursOrOrganizationOrSpace()] },
    {
      all: [
        ownedByIntegration,
        heldAtOwner('integration.'),
        yoursOrOrganizationOrSpace('integration.'),
      ],
    },
  ],
};

export const managedUpTheChain: ActionRule = {
  any: [
    { all: [notOwnedByIntegration, onOwner('manage')] },
    { all: [ownedByIntegration, onOwner('manage', 'integration.')] },
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

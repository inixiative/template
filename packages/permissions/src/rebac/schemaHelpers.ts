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
export const lowRoles = roleHierarchy.filter((role) => !highRoles.includes(role));
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

type OwnerModel = (typeof ownerRelations)[number][0];

const everyOwner = ownerRelations.map(([ownerModel]) => ownerModel);
const organizationOrSpace: OwnerModel[] = ['Organization', 'Space'];
const members: OwnerModel[] = ['OrganizationUser', 'SpaceUser'];
const notIntegration = everyOwner.filter((ownerModel) => ownerModel !== 'Integration');

export const ownedBy = (owners: OwnerModel[], at = ''): ActionRule => ({
  rule: { field: `${at}ownerModel`, operator: Operator.in, value: owners },
});

export const actionOnOwner = (
  action: string,
  at = '',
  owners: OwnerModel[] = everyOwner,
): ActionRule => ({
  any: ownerRelations
    .filter(([ownerModel]) => owners.includes(ownerModel))
    .map(([ownerModel, rel]) => ({
      all: [ownedBy([ownerModel], at), { rel: `${at}${rel}`, action }],
    })),
});

const actorIsUserAt = (field: string): ActionRule => ({
  all: [actorIsUser, { rule: { field, operator: Operator.equals, path: '__actor.record.id' } }],
});

export const actorIsItsUser = (at = ''): ActionRule => ({
  all: [
    { rule: { field: `${at}userId`, operator: Operator.notEmpty } },
    {
      any: [
        actorIsUserAt(`${at}userId`),
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

const roleHeldVia = (heldAt: (action: string) => ActionRule): ActionRule => ({
  any: [
    { all: [{ rule: { field: 'role', operator: Operator.equals, value: null } }, heldAt('read')] },
    ...roleHierarchy.map((role) => ({
      all: [
        { rule: { field: 'role', operator: Operator.equals, value: role } },
        heldAt(roleToStandardAction(role)),
      ],
    })),
  ],
});

export const roleHeldAtOwner = (at = ''): ActionRule =>
  roleHeldVia((action) => actionOnOwner(action, at));

export const memberRoleWrite = (tenant: 'organization' | 'space'): ActionRule => ({
  all: [{ rel: tenant, action: 'manage' }, roleHeldVia((action) => ({ rel: tenant, action }))],
});

export const memberRemoval = (tenant: 'organization' | 'space'): ActionRule => ({
  any: ['leave', memberRoleWrite(tenant)],
});

export const ownedByYouOrOrganizationOrSpace = (at = ''): ActionRule => ({
  any: [ownedBy(organizationOrSpace, at), actorIsItsUser(at)],
});

export const createdByItsUserOrManager: ActionRule = {
  any: [actionOnOwner('operate', '', ['User']), actionOnOwner('manage', '', organizationOrSpace)],
};

const notMembers: OwnerModel[] = ['User', 'Organization', 'Space'];

const actorHoldsItsRow: ActionRule = {
  any: [
    actorIsUserAt('userId'),
    { rule: { field: 'userId', operator: Operator.equals, path: '__actor.record.userId' } },
  ],
};

export const actorHoldsItsChain: ActionRule = {
  any: [
    { all: [ownedBy(['User', ...members]), actorIsUserAt('userId')] },
    {
      all: [
        ownedBy(['Integration']),
        ownedBy(['User', ...members], 'integration.'),
        actorIsUserAt('integration.userId'),
      ],
    },
  ],
};

const membersIntegration = actionOnOwner('own', '', members);

const usersIntegration: ActionRule = { all: [ownedBy(['User']), actorIsItsUser()] };

export const integrationAdministering = {
  create: {
    any: [
      createdByItsUserOrManager,
      {
        all: [ownedBy(members), actorHoldsItsRow, 'manage', actionOnOwner('operate', '', members)],
      },
    ],
  },
  own: {
    any: [usersIntegration, actionOnOwner('own', '', organizationOrSpace), membersIntegration],
  },
  manage: {
    any: [usersIntegration, actionOnOwner('manage', '', organizationOrSpace), membersIntegration],
  },
  delete: { any: ['manage', actionOnOwner('manage', '', notMembers)] },
} satisfies Record<string, ActionRule>;

export const integrationAccess = {
  operate: { any: [actionOnOwner('operate', '', notMembers), membersIntegration] },
  read: { any: [actionOnOwner('read', '', notMembers), membersIntegration] },
} satisfies Record<string, ActionRule>;

export const integrationRoleWrite: ActionRule = {
  any: [
    actorHoldsItsChain,
    {
      all: ['manage', roleHeldAtOwner(), { any: [ownedBy(organizationOrSpace), actorHoldsItsRow] }],
    },
  ],
};

export const tokenAccessIsYours: ActionRule = {
  any: [
    {
      all: [
        ownedBy(notIntegration),
        ownedByYouOrOrganizationOrSpace(),
        { any: [ownedBy(['User', ...members]), roleHeldAtOwner()] },
      ],
    },
    {
      all: [
        ownedBy(['Integration']),
        ownedByYouOrOrganizationOrSpace('integration.'),
        { any: [ownedBy(['User', ...members], 'integration.'), roleHeldAtOwner('integration.')] },
      ],
    },
  ],
};

export const managedUpTheChain: ActionRule = {
  any: [
    actionOnOwner('manage', '', notIntegration),
    { all: [ownedBy(['Integration']), { rel: 'integration', action: 'manage' }] },
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

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

export const delegateHoldsOperate: ActionRule = {
  any: [
    { rule: { field: '__actor.record.full', operator: Operator.equals, value: true } },
    {
      rule: {
        field: '__actor.record.role',
        operator: Operator.in,
        value: roleHierarchy.slice(roleHierarchy.indexOf('member')),
      },
    },
  ],
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

export const managesItsUser = (at = ''): ActionRule => ({ rel: `${at}user`, action: 'manage' });

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
  any: [ownedBy(organizationOrSpace, at), managesItsUser(at)],
});

export const createdByItsUserOrManager: ActionRule = {
  any: [actionOnOwner('operate', '', ['User']), actionOnOwner('manage', '', organizationOrSpace)],
};

const notMembers: OwnerModel[] = ['User', 'Organization', 'Space'];

const membersIntegration: ActionRule = {
  any: [{ all: [ownedBy(members), managesItsUser()] }, actionOnOwner('own', '', members)],
};

export const integrationAdministering = {
  create: {
    any: [
      createdByItsUserOrManager,
      { all: [ownedBy(members), managesItsUser(), actionOnOwner('manage', '', members)] },
    ],
  },
  own: {
    any: [managesItsUser(), actionOnOwner('own', '', organizationOrSpace), membersIntegration],
  },
  manage: {
    any: [managesItsUser(), actionOnOwner('manage', '', organizationOrSpace), membersIntegration],
  },
  delete: { any: ['manage', actionOnOwner('manage', '', notMembers)] },
} satisfies Record<string, ActionRule>;

const sameOwnerRowAsActor: ActionRule = {
  all: ['ownerModel', 'organizationId', 'spaceId', 'userId'].map((field) => ({
    rule: { field, operator: Operator.equals, path: `__actor.record.${field}` },
  })),
};

const membersOwnDelegate = (action: string): ActionRule => ({
  all: [ownedBy(members), sameOwnerRowAsActor, actionOnOwner(action, '', members)],
});

export const integrationAccess = {
  operate: {
    any: [
      'manage',
      actionOnOwner('operate', '', notMembers),
      membersIntegration,
      membersOwnDelegate('operate'),
    ],
  },
  read: {
    any: [
      'operate',
      actionOnOwner('read', '', notMembers),
      membersIntegration,
      membersOwnDelegate('read'),
    ],
  },
} satisfies Record<string, ActionRule>;

export const integrationRoleWrite: ActionRule = { all: ['manage', roleHeldAtOwner()] };

export const tokenAccessIsYours: ActionRule = {
  any: [
    { all: [ownedBy(notIntegration), roleHeldAtOwner(), ownedByYouOrOrganizationOrSpace()] },
    {
      all: [
        ownedBy(['Integration']),
        roleHeldAtOwner('integration.'),
        ownedByYouOrOrganizationOrSpace('integration.'),
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

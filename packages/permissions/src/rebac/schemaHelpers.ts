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

export const memberRowActions = (tenant: 'organization' | 'space') => ({
  own: { rel: tenant, action: 'own' },
  manage: { any: ['own', { rel: tenant, action: 'manage' }] },
  operate: { rel: 'user', action: 'operate' },
  read: {
    any: ['operate', 'manage', { rel: 'user', action: 'read' }, { rel: tenant, action: 'read' }],
  },
  leave: { rel: 'user', action: 'operate' },
  delegateFull: { all: [actorIsUser, 'operate'] },
});

export const ownedByYouOrOrganizationOrSpace = (at = ''): ActionRule => ({
  any: [ownedBy(organizationOrSpace, at), managesItsUser(at)],
});

export const createdByItsUserOrManager: ActionRule = {
  any: [actionOnOwner('operate', '', ['User']), actionOnOwner('manage', '', organizationOrSpace)],
};

const notMembers: OwnerModel[] = ['User', 'Organization', 'Space'];

const operatesAtItsMembersTenant: ActionRule = {
  any: [
    { all: [ownedBy(['OrganizationUser']), { rel: 'organization', action: 'operate' }] },
    { all: [ownedBy(['SpaceUser']), { rel: 'space', action: 'operate' }] },
  ],
};

export const integrationAdministering = {
  create: {
    any: [
      createdByItsUserOrManager,
      {
        all: [
          ownedBy(members),
          'manage',
          actionOnOwner('operate', '', members),
          operatesAtItsMembersTenant,
        ],
      },
    ],
  },
  manage: {
    any: [
      { all: [ownedBy(['User']), managesItsUser()] },
      actionOnOwner('manage', '', organizationOrSpace),
      actionOnOwner('operate', '', members),
    ],
  },
  delete: { any: ['manage', actionOnOwner('own', '', members)] },
  delegateFull: {
    all: [
      actorIsUser,
      {
        any: [
          { all: [ownedBy(['User']), managesItsUser()] },
          actionOnOwner('own', '', organizationOrSpace),
          actionOnOwner('operate', '', members),
        ],
      },
    ],
  },
} satisfies Record<string, ActionRule>;

export const integrationAccess = {
  operate: { any: ['manage', actionOnOwner('operate', '', notMembers)] },
  read: {
    any: ['operate', actionOnOwner('read', '', notMembers), actionOnOwner('own', '', members)],
  },
} satisfies Record<string, ActionRule>;

export const integrationRoleWrite: ActionRule = {
  any: [actionOnOwner('delegateFull'), { all: ['manage', roleHeldAtOwner()] }],
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

export const tokenAdministering: ActionRule = {
  any: [
    { all: [ownedBy(['User']), managesItsUser()] },
    actionOnOwner('manage', '', organizationOrSpace),
    actionOnOwner('operate', '', members),
    actionOnOwner('own', '', members),
    { all: [ownedBy(['Integration']), { rel: 'integration', action: 'delete' }] },
  ],
};

type StandardRules = { own: ActionRule; manage: ActionRule; operate: ActionRule; read: ActionRule };

export const chainedStandardActions = ({ own, manage, operate, read }: StandardRules) => ({
  own,
  manage: { any: ['own', manage] },
  operate: { any: ['manage', operate] },
  read: { any: ['operate', read] },
});

export const ownerActions = (
  rels: readonly string[] = ['user', 'organization', 'space'],
): ResourcePermission['actions'] => {
  const fanout = (action: string): ActionRule => ({
    any: rels.map((rel) => ({ rel, action })),
  });
  return chainedStandardActions({
    own: fanout('own'),
    manage: fanout('manage'),
    operate: fanout('operate'),
    read: fanout('read'),
  });
};

/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import { makeKindRules, ruleFieldEqualsPath } from '@inixiative/permissions';
import { schemaMap } from '@template/db/schemaMap';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';
import { omit } from 'lodash-es';

export const privilegedRoles = ['owner', 'admin'];
export const unprivilegedRoles = roleHierarchy.filter((role) => !privilegedRoles.includes(role));
const kind = makeKindRules(schemaMap);

export const isNull = (field: string): Condition => ({
  field,
  operator: Operator.equals,
  value: null,
});

export const rowIsThereAnd = (rowKey: string, ...conditions: Condition[]): ActionRule => ({
  rule: { all: [{ field: rowKey, operator: Operator.exists }, ...conditions] },
});

export const actorIsUser: ActionRule = kind.ruleKindIsOneOf('actor:Acting', 'model', ['User']);

export const actorIsDelegateOfUser: ActionRule = kind.ruleForEachKind('actor:Acting', 'model', {
  Token: kind.ruleKindIsOneOf('actor:Token', 'ownerModel', ['User']),
});

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

export const actingAsAPerson: ActionRule = kind.ruleForEachKind('actor:Acting', 'model', {
  User: true,
  Token: kind.ruleKindIsOneOf('actor:Token', 'ownerModel', notIntegration),
});

export const actingAsTheRecordsIntegration: ActionRule = kind.ruleForEachKind(
  'actor:Acting',
  'model',
  {
    Token: {
      all: [
        kind.ruleKindIsOneOf('actor:Token', 'ownerModel', ['Integration']),
        ruleFieldEqualsPath('integrationId', 'actor:Token.integrationId'),
      ],
    },
  },
);

export const ownerModelIsOneOf = (owners: OwnerModel[], at = ''): ActionRule => ({
  rule: { field: `${at}ownerModel`, operator: Operator.in, value: owners },
});

export const actorMayPerformActionOnOwner = (
  action: string,
  at = '',
  owners: OwnerModel[] = everyOwner,
): ActionRule => ({
  any: ownerRelations
    .filter(([ownerModel]) => owners.includes(ownerModel))
    .map(([ownerModel, rel]) => ({
      all: [ownerModelIsOneOf([ownerModel], at), { rel: `${at}${rel}`, action }],
    })),
});

export const actorManagesRecordUser = (at = ''): ActionRule => ({
  rel: `${at}user`,
  action: 'manage',
});

export const roleHeldVia = (heldAt: (action: string) => ActionRule): ActionRule => ({
  any: [
    { all: [rowIsThereAnd('id', isNull('role')), heldAt('read')] },
    ...roleHierarchy.map((role) => ({
      all: [
        { rule: { field: 'role', operator: Operator.equals, value: role } },
        heldAt(roleToStandardAction(role)),
      ],
    })),
  ],
});

export const roleHeldAtOwner = (at = '', owners: OwnerModel[] = everyOwner): ActionRule =>
  roleHeldVia((action) => actorMayPerformActionOnOwner(action, at, owners));

export const memberRoleWrite = (tenant: 'organization' | 'space'): ActionRule => ({
  all: [{ rel: tenant, action: 'manage' }, roleHeldVia((action) => ({ rel: tenant, action }))],
});

export const memberRemoval = (tenant: 'organization' | 'space'): ActionRule => ({
  any: ['leave', memberRoleWrite(tenant)],
});

export const memberRowActions = (tenant: 'organization' | 'space') => ({
  own: { rel: tenant, action: 'own' },
  manage: { any: ['own', { rel: tenant, action: 'manage' }] },
  operate: { rel: 'user', action: 'manage' },
  read: {
    any: ['operate', 'manage', { rel: 'user', action: 'read' }, { rel: tenant, action: 'read' }],
  },
  leave: { rel: 'user', action: 'manage' },
  delegateFull: { all: [actorIsUser, 'operate'] },
});

export const ownedByYouOrOrganizationOrSpaceYouManage = (at = ''): ActionRule => ({
  any: [
    actorMayPerformActionOnOwner('manage', at, organizationOrSpace),
    actorManagesRecordUser(at),
  ],
});

export const actorOperatesOwnerUserOrManagesOwnerTenant: ActionRule = {
  any: [
    actorMayPerformActionOnOwner('operate', '', ['User']),
    actorMayPerformActionOnOwner('manage', '', organizationOrSpace),
  ],
};

const notMembers: OwnerModel[] = ['User', 'Organization', 'Space'];

const operatesAtItsMembersTenant: ActionRule = {
  any: [
    { all: [ownerModelIsOneOf(['OrganizationUser']), { rel: 'organization', action: 'operate' }] },
    { all: [ownerModelIsOneOf(['SpaceUser']), { rel: 'space', action: 'operate' }] },
  ],
};

export const integrationAdministering = {
  create: {
    any: [
      actorOperatesOwnerUserOrManagesOwnerTenant,
      {
        all: [
          ownerModelIsOneOf(members),
          actorMayPerformActionOnOwner('operate', '', members),
          operatesAtItsMembersTenant,
        ],
      },
    ],
  },
  manage: {
    any: [
      actorMayPerformActionOnOwner('manage', '', ['User']),
      actorMayPerformActionOnOwner('manage', '', organizationOrSpace),
      actorMayPerformActionOnOwner('operate', '', members),
    ],
  },
  delete: { any: ['manage', actorMayPerformActionOnOwner('own', '', members)] },
  delegateFull: {
    all: [
      actorIsUser,
      {
        any: [
          actorMayPerformActionOnOwner('manage', '', ['User']),
          actorMayPerformActionOnOwner('own', '', organizationOrSpace),
          actorMayPerformActionOnOwner('operate', '', members),
        ],
      },
    ],
  },
} satisfies Record<string, ActionRule>;

export const integrationAccess = {
  operate: { any: ['manage', actorMayPerformActionOnOwner('operate', '', notMembers)] },
  read: {
    any: [
      'operate',
      actorMayPerformActionOnOwner('read', '', notMembers),
      actorMayPerformActionOnOwner('own', '', members),
    ],
  },
} satisfies Record<string, ActionRule>;

export const actionsForRecordOwnedByAnyOwnerModel = {
  ...omit(integrationAdministering, 'delegateFull'),
  ...integrationAccess,
} satisfies Record<string, ActionRule>;

// Read on an integration row, whose owner is never another integration.
export const integrationRoleWrite: ActionRule = {
  any: [
    actorMayPerformActionOnOwner('delegateFull', '', notIntegration),
    { all: ['manage', roleHeldAtOwner('', notIntegration)] },
  ],
};

export const actorMayCreateTokenAtOwnerWithRole: ActionRule = {
  any: [
    {
      all: [
        ownerModelIsOneOf(notIntegration),
        ownedByYouOrOrganizationOrSpaceYouManage(),
        { any: [ownerModelIsOneOf(['User', ...members]), roleHeldAtOwner('', notIntegration)] },
      ],
    },
    {
      all: [
        ownerModelIsOneOf(['Integration']),
        ownedByYouOrOrganizationOrSpaceYouManage('integration.'),
        {
          any: [
            ownerModelIsOneOf(['User', ...members], 'integration.'),
            // An integration's owner is never another integration: no `integration.integration`.
            roleHeldAtOwner('integration.', notIntegration),
          ],
        },
      ],
    },
  ],
};

export const tokenAdministering: ActionRule = {
  any: [
    actorMayPerformActionOnOwner('manage', '', ['User']),
    actorMayPerformActionOnOwner('manage', '', organizationOrSpace),
    actorMayPerformActionOnOwner('operate', '', members),
    actorMayPerformActionOnOwner('own', '', members),
    { all: [ownerModelIsOneOf(['Integration']), { rel: 'integration', action: 'delete' }] },
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

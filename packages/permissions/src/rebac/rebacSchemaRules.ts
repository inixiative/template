/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import { type Condition, Operator } from '@inixiative/json-rules';
import { makeKindRules, ruleFieldEqualsPath } from '@inixiative/permissions';
import { schemaMapWithoutPermissions } from '@template/db/schemaMap';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';
import { omit } from 'lodash-es';

export const privilegedRoles = ['owner', 'admin'];
export const unprivilegedRoles = roleHierarchy.filter((role) => !privilegedRoles.includes(role));
const kind = makeKindRules(schemaMapWithoutPermissions);

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

const ownerAxis = 'ownerModel';
const organizationOrSpace = ['Organization', 'Space'];
const members = ['OrganizationUser', 'SpaceUser'];
const notMembers = ['User', ...organizationOrSpace];
const notIntegration = [...notMembers, ...members];

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

export const actorManagesRecordUser = (at = ''): ActionRule => ({
  rel: `${at}user`,
  action: 'manage',
});

const roleHeldVia = (heldAt: (action: string) => ActionRule): ActionRule => ({
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

/** The owner rules of `resource`, read where `at` reaches it (`'db:Integration'` at `'integration.'`): its owner kinds and each kind's relation come from the polymorphism registry. */
export const makeOwnerRules = (resource: string, at = '') => {
  const ownerModelIsOneOf = (owners: readonly string[]): ActionRule =>
    kind.ruleKindIsOneOf(resource, ownerAxis, owners, at);
  const actorMayPerformActionOnOwner = (action: string, owners?: readonly string[]): ActionRule =>
    kind.ruleActionThroughEachKind(resource, ownerAxis, action, owners, at);
  return {
    ownerModelIsOneOf,
    actorMayPerformActionOnOwner,
    roleHeldAtOwner: (owners?: readonly string[]): ActionRule =>
      roleHeldVia((action) => actorMayPerformActionOnOwner(action, owners)),
    ownedByYouOrOrganizationOrSpaceYouManage: {
      any: [
        actorMayPerformActionOnOwner('manage', organizationOrSpace),
        actorManagesRecordUser(at),
      ],
    } satisfies ActionRule,
    actorOperatesOwnerUserOrManagesOwnerTenant: {
      any: [
        actorMayPerformActionOnOwner('operate', ['User']),
        actorMayPerformActionOnOwner('manage', organizationOrSpace),
      ],
    } satisfies ActionRule,
  };
};

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

const administeringOfRecordOwnedByAnyOwnerModel = (resource: string) => {
  const owner = makeOwnerRules(resource);
  return {
    create: {
      any: [
        owner.actorOperatesOwnerUserOrManagesOwnerTenant,
        {
          all: [
            owner.ownerModelIsOneOf(members),
            owner.actorMayPerformActionOnOwner('operate', members),
            kind.ruleForEachKind(resource, ownerAxis, {
              OrganizationUser: { rel: 'organization', action: 'operate' },
              SpaceUser: { rel: 'space', action: 'operate' },
            }),
          ],
        },
      ],
    },
    manage: {
      any: [
        owner.actorMayPerformActionOnOwner('manage', ['User']),
        owner.actorMayPerformActionOnOwner('manage', organizationOrSpace),
        owner.actorMayPerformActionOnOwner('operate', members),
      ],
    },
    delete: { any: ['manage', owner.actorMayPerformActionOnOwner('own', members)] },
    delegateFull: {
      all: [
        actorIsUser,
        {
          any: [
            owner.actorMayPerformActionOnOwner('manage', ['User']),
            owner.actorMayPerformActionOnOwner('own', organizationOrSpace),
            owner.actorMayPerformActionOnOwner('operate', members),
          ],
        },
      ],
    },
  } satisfies Record<string, ActionRule>;
};

const accessOfRecordOwnedByAnyOwnerModel = (resource: string) => {
  const owner = makeOwnerRules(resource);
  return {
    operate: { any: ['manage', owner.actorMayPerformActionOnOwner('operate', notMembers)] },
    read: {
      any: [
        'operate',
        owner.actorMayPerformActionOnOwner('read', notMembers),
        owner.actorMayPerformActionOnOwner('own', members),
      ],
    },
  } satisfies Record<string, ActionRule>;
};

export const integrationAdministering = administeringOfRecordOwnedByAnyOwnerModel('db:Integration');
export const integrationAccess = accessOfRecordOwnedByAnyOwnerModel('db:Integration');

export const actionsForRecordOwnedByAnyOwnerModel = (resource: string) =>
  ({
    ...omit(administeringOfRecordOwnedByAnyOwnerModel(resource), 'delegateFull'),
    ...accessOfRecordOwnedByAnyOwnerModel(resource),
  }) satisfies Record<string, ActionRule>;

const ownerOfIntegration = makeOwnerRules('db:Integration');
const ownerOfToken = makeOwnerRules('db:Token');
const ownerOfTokensIntegration = makeOwnerRules('db:Integration', 'integration.');

export const integrationRoleWrite: ActionRule = {
  any: [
    ownerOfIntegration.actorMayPerformActionOnOwner('delegateFull'),
    { all: ['manage', ownerOfIntegration.roleHeldAtOwner()] },
  ],
};

export const actorMayCreateTokenAtOwnerWithRole: ActionRule = {
  any: [
    {
      all: [
        ownerOfToken.ownerModelIsOneOf(notIntegration),
        ownerOfToken.ownedByYouOrOrganizationOrSpaceYouManage,
        {
          any: [
            ownerOfToken.ownerModelIsOneOf(['User', ...members]),
            ownerOfToken.roleHeldAtOwner(notIntegration),
          ],
        },
      ],
    },
    {
      all: [
        ownerOfToken.ownerModelIsOneOf(['Integration']),
        ownerOfTokensIntegration.ownedByYouOrOrganizationOrSpaceYouManage,
        {
          any: [
            ownerOfTokensIntegration.ownerModelIsOneOf(['User', ...members]),
            ownerOfTokensIntegration.roleHeldAtOwner(),
          ],
        },
      ],
    },
  ],
};

export const tokenAdministering: ActionRule = {
  any: [
    ownerOfToken.actorMayPerformActionOnOwner('manage', ['User']),
    ownerOfToken.actorMayPerformActionOnOwner('manage', organizationOrSpace),
    ownerOfToken.actorMayPerformActionOnOwner('operate', members),
    ownerOfToken.actorMayPerformActionOnOwner('own', members),
    kind.ruleForEachKind('db:Token', ownerAxis, {
      Integration: { rel: 'integration', action: 'delete' },
    }),
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

/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz, feature:files
 * @uses none
 */
import { DateOperator, Operator } from '@inixiative/json-rules';
import { makeKindRules } from '@inixiative/permissions';
import { type ArtifactAccess, ArtifactKind, type Role } from '@template/db/generated/client/enums';
import { schemaMapWithoutPermissions } from '@template/db/schemaMap';
import type { StandardAction } from '@template/permissions/client';
import {
  actorMayPerformActionOnOwner,
  integrationAdministering,
  isNull,
  ownerModelIsOneOf,
  roleHeldVia,
  rowIsThereAnd,
} from '@template/permissions/rebac/rebacSchemaRules';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';
import { roleHierarchy } from '@template/permissions/roles/shared';

const kind = makeKindRules(schemaMapWithoutPermissions);

const rolesCovering: Record<StandardAction, readonly Role[]> = {
  own: roleHierarchy.slice(roleHierarchy.indexOf('owner')),
  manage: roleHierarchy.slice(roleHierarchy.indexOf('admin')),
  operate: roleHierarchy.slice(roleHierarchy.indexOf('member')),
  read: roleHierarchy,
};

const nonRootArtifactKinds = Object.values(ArtifactKind).filter((k) => k !== ArtifactKind.root);

const actingAsMemberToken: ActionRule = kind.ruleForEachKind('actor:Acting', 'model', {
  Token: kind.ruleKindIsOneOf('actor:Token', 'ownerModel', ['OrganizationUser', 'SpaceUser']),
});

const memberOwns = (
  rel: 'organizationUser' | 'spaceUser' | 'granteeOrganizationUser' | 'granteeSpaceUser',
  prefix = '',
): ActionRule => ({
  any: [
    { rel: `${prefix}${rel}.user`, action: 'own' },
    { all: [actingAsMemberToken, { rel: `${prefix}${rel}`, action: 'operate' }] },
  ],
});

const granteeIs = (granteeModel: string, prefix: string): ActionRule => ({
  rule: { field: `${prefix}granteeModel`, operator: Operator.equals, value: granteeModel },
});

const granteeWalk = (
  actions: { user: StandardAction; tenant: StandardAction; member?: 'own' | 'operate' },
  prefix = '',
): ActionRule => {
  const memberRule = (rel: 'granteeOrganizationUser' | 'granteeSpaceUser'): ActionRule =>
    actions.member === 'own'
      ? memberOwns(rel, prefix)
      : { rel: `${prefix}${rel}`, action: 'operate' };
  return {
    any: [
      { all: [granteeIs('User', prefix), { rel: `${prefix}granteeUser`, action: actions.user }] },
      {
        all: [
          granteeIs('Organization', prefix),
          { rel: `${prefix}granteeOrganization`, action: actions.tenant },
        ],
      },
      {
        all: [granteeIs('Space', prefix), { rel: `${prefix}granteeSpace`, action: actions.tenant }],
      },
      { all: [granteeIs('OrganizationUser', prefix), memberRule('granteeOrganizationUser')] },
      { all: [granteeIs('SpaceUser', prefix), memberRule('granteeSpaceUser')] },
      {
        all: [
          granteeIs('CustomerRelationship', prefix),
          {
            any: [
              {
                rel: `${prefix}granteeCustomerRelationship.customerUser`,
                action: actions.user,
              },
              {
                rel: `${prefix}granteeCustomerRelationship.customerOrganization`,
                action: actions.tenant,
              },
              {
                rel: `${prefix}granteeCustomerRelationship.customerSpace`,
                action: actions.tenant,
              },
            ],
          },
        ],
      },
    ],
  };
};

const grantNotExpired: ActionRule = {
  any: [
    rowIsThereAnd('artifactPermission.id', isNull('artifactPermission.expiresAt')),
    {
      rule: {
        all: [
          { field: 'artifactPermission.expiresAt', operator: Operator.exists },
          {
            field: 'artifactPermission.expiresAt',
            dateOperator: DateOperator.after,
            path: 'actor:Clock.now',
          },
        ],
      },
    },
  ],
};

const effectiveGrant = (action: StandardAction): ActionRule => ({
  rel: 'artifactEffectivePermissions',
  arrayOperator: 'any',
  condition: {
    all: [
      {
        rule: {
          field: 'artifactPermission.role',
          operator: Operator.in,
          value: [...rolesCovering[action]],
        },
      },
      grantNotExpired,
      granteeWalk(
        { user: action, tenant: action, member: action === 'own' ? 'own' : 'operate' },
        'artifactPermission.',
      ),
    ],
  },
});

const ownerTenantRead = (at = ''): ActionRule => ({
  any: [
    {
      all: [
        ownerModelIsOneOf(['Organization', 'OrganizationUser'], at),
        { rel: `${at}organization`, action: 'read' },
      ],
    },
    {
      all: [ownerModelIsOneOf(['Space', 'SpaceUser'], at), { rel: `${at}space`, action: 'read' }],
    },
  ],
});

export const ownerPrivateRead = (at = ''): ActionRule => ({
  any: [
    at ? { rel: at.slice(0, -1), action: 'manage' } : 'manage',
    actorMayPerformActionOnOwner('read', at, ['User']),
    actorMayPerformActionOnOwner('own', at, ['OrganizationUser', 'SpaceUser']),
  ],
});

const artifactIsPublic: ActionRule = {
  rule: { field: 'effectiveAccess', operator: Operator.equals, value: 'public' },
};

const artifactIsTenant: ActionRule = {
  all: [
    { rule: { field: 'effectiveAccess', operator: Operator.equals, value: 'tenant' } },
    ownerTenantRead(),
  ],
};

export const artifactResourcePermission: ResourcePermission = {
  actions: {
    own: {
      any: [
        actorMayPerformActionOnOwner('own', '', ['User', 'Organization', 'Space']),
        { all: [ownerModelIsOneOf(['OrganizationUser']), memberOwns('organizationUser')] },
        { all: [ownerModelIsOneOf(['SpaceUser']), memberOwns('spaceUser')] },
        effectiveGrant('own'),
      ],
    },
    delete: {
      any: ['own', actorMayPerformActionOnOwner('own', '', ['OrganizationUser', 'SpaceUser'])],
    },
    manage: { any: ['own', integrationAdministering.manage, effectiveGrant('manage')] },
    operate: {
      any: [
        'manage',
        actorMayPerformActionOnOwner('operate', '', ['User']),
        effectiveGrant('operate'),
      ],
    },
    read: {
      any: [
        'operate',
        actorMayPerformActionOnOwner('read', '', ['User']),
        actorMayPerformActionOnOwner('own', '', ['OrganizationUser', 'SpaceUser']),
        effectiveGrant('read'),
        artifactIsPublic,
        artifactIsTenant,
      ],
    },
    create: integrationAdministering.create,
  },
};

const artifactPermissionRoleWrite: ActionRule = {
  all: [
    { rel: 'artifact', action: 'manage' },
    roleHeldVia((action) => ({ rel: 'artifact', action })),
  ],
};

export const artifactPermissionResourcePermission: ResourcePermission = {
  actions: {
    manage: artifactPermissionRoleWrite,
    read: {
      any: [
        'manage',
        'leave',
        granteeWalk({ user: 'read', tenant: 'read' }),
        { rel: 'artifact', action: 'manage' },
      ],
    },
    create: artifactPermissionRoleWrite,
    leave: granteeWalk({ user: 'operate', tenant: 'manage' }),
    delete: { any: ['leave', artifactPermissionRoleWrite] },
  },
};

const accessIs = (...values: ArtifactAccess[]): ActionRule =>
  values.length === 1
    ? { rule: { field: 'access', operator: Operator.equals, value: values[0] } }
    : { rule: { field: 'access', operator: Operator.in, value: values } };

const containerIsRoot: ActionRule = {
  rule: { field: 'containerArtifact.kind', operator: Operator.equals, value: ArtifactKind.root },
};

const containerIsNotRoot: ActionRule = {
  rule: { field: 'containerArtifact.kind', operator: Operator.in, value: nonRootArtifactKinds },
};

const placementAccessRead = (allowInherit: boolean): ActionRule => ({
  any: [
    allowInherit ? accessIs('inherit', 'public') : accessIs('public'),
    { all: [accessIs('tenant'), ownerTenantRead('containerArtifact.')] },
    ownerPrivateRead('containerArtifact.'),
  ],
});

export const artifactPlacementResourcePermission: ResourcePermission = {
  actions: {
    create: {
      all: [
        { rel: 'artifact', action: 'read' },
        { rel: 'containerArtifact', action: 'operate' },
      ],
    },
    manage: {
      all: [
        { rel: 'artifact', action: 'read' },
        { rel: 'containerArtifact', action: 'manage' },
      ],
    },
    delete: {
      any: [
        { rel: 'containerArtifact', action: 'manage' },
        {
          all: [
            { rel: 'containerArtifact', action: 'operate' },
            {
              any: [
                accessIs('inherit', 'public'),
                { all: [accessIs('tenant'), ownerTenantRead('containerArtifact.')] },
              ],
            },
          ],
        },
      ],
    },
    read: {
      any: [
        'manage',
        {
          all: [
            { rel: 'artifact', action: 'read' },
            {
              any: [
                { all: [containerIsRoot, placementAccessRead(false)] },
                {
                  all: [
                    containerIsNotRoot,
                    { rel: 'containerArtifact', action: 'read' },
                    placementAccessRead(true),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
};

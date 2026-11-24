/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz, feature:files
 * @uses none
 */
import { DateOperator, Operator } from '@inixiative/json-rules';
import { makeKindRules } from '@inixiative/permissions';
import type { Role } from '@template/db/generated/client/enums';
import { schemaMap } from '@template/db/schemaMap';
import {
  actorMayPerformActionOnOwner,
  isNull,
  ownerModelIsOneOf,
  roleHeldVia,
  rowIsThereAnd,
} from '@template/permissions/rebac/rebacSchemaRules';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';
import { roleHierarchy } from '@template/permissions/roles/shared';

const kind = makeKindRules(schemaMap);

type StandardAction = 'own' | 'manage' | 'operate' | 'read';

const rolesCovering: Record<StandardAction, readonly Role[]> = {
  own: roleHierarchy.slice(roleHierarchy.indexOf('owner')),
  manage: roleHierarchy.slice(roleHierarchy.indexOf('admin')),
  operate: roleHierarchy.slice(roleHierarchy.indexOf('member')),
  read: roleHierarchy,
};

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

const granteeIs = (granteeModel: string): ActionRule => ({
  rule: { field: 'permission.granteeModel', operator: Operator.equals, value: granteeModel },
});

const grantNotExpired: ActionRule = {
  any: [
    rowIsThereAnd('permission.id', isNull('permission.expiresAt')),
    {
      rule: {
        all: [
          { field: 'permission.expiresAt', operator: Operator.exists },
          {
            field: 'permission.expiresAt',
            dateOperator: DateOperator.after,
            path: 'actor:Clock.now',
          },
        ],
      },
    },
  ],
};

const effectiveGrant = (action: StandardAction): ActionRule => ({
  rel: 'effectivePermissions',
  arrayOperator: 'any',
  condition: {
    all: [
      {
        rule: {
          field: 'permission.role',
          operator: Operator.in,
          value: [...rolesCovering[action]],
        },
      },
      grantNotExpired,
      {
        any: [
          { all: [granteeIs('User'), { rel: 'permission.granteeUser', action }] },
          { all: [granteeIs('Organization'), { rel: 'permission.granteeOrganization', action }] },
          { all: [granteeIs('Space'), { rel: 'permission.granteeSpace', action }] },
          {
            all: [
              granteeIs('OrganizationUser'),
              action === 'own'
                ? memberOwns('granteeOrganizationUser', 'permission.')
                : { rel: 'permission.granteeOrganizationUser', action: 'operate' },
            ],
          },
          {
            all: [
              granteeIs('SpaceUser'),
              action === 'own'
                ? memberOwns('granteeSpaceUser', 'permission.')
                : { rel: 'permission.granteeSpaceUser', action: 'operate' },
            ],
          },
          {
            all: [
              granteeIs('CustomerRelationship'),
              {
                any: [
                  { rel: 'permission.granteeCustomerRelationship.customerUser', action },
                  { rel: 'permission.granteeCustomerRelationship.customerOrganization', action },
                  { rel: 'permission.granteeCustomerRelationship.customerSpace', action },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});

const artifactIsPublic: ActionRule = {
  any: [
    { rule: { field: 'access', operator: Operator.equals, value: 'public' } },
    {
      all: [
        { rule: { field: 'access', operator: Operator.equals, value: 'inherit' } },
        {
          rel: 'ancestors',
          arrayOperator: 'any',
          condition: {
            all: [
              { rule: { field: 'inherits', operator: Operator.equals, value: true } },
              {
                rule: {
                  field: 'ancestorArtifact.access',
                  operator: Operator.equals,
                  value: 'public',
                },
              },
            ],
          },
        },
      ],
    },
  ],
};

const operatesAtItsMembersTenant: ActionRule = {
  any: [
    { all: [ownerModelIsOneOf(['OrganizationUser']), { rel: 'organization', action: 'operate' }] },
    { all: [ownerModelIsOneOf(['SpaceUser']), { rel: 'space', action: 'operate' }] },
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
    manage: {
      any: [
        'own',
        actorMayPerformActionOnOwner('manage', '', ['User', 'Organization', 'Space']),
        actorMayPerformActionOnOwner('operate', '', ['OrganizationUser', 'SpaceUser']),
        effectiveGrant('manage'),
      ],
    },
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
      ],
    },
    create: {
      any: [
        actorMayPerformActionOnOwner('operate', '', ['User', 'Organization', 'Space']),
        {
          all: [
            ownerModelIsOneOf(['OrganizationUser', 'SpaceUser']),
            actorMayPerformActionOnOwner('operate', '', ['OrganizationUser', 'SpaceUser']),
            operatesAtItsMembersTenant,
          ],
        },
      ],
    },
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
    read: { any: ['manage', { rel: 'artifact', action: 'manage' }] },
    create: artifactPermissionRoleWrite,
    delete: artifactPermissionRoleWrite,
  },
};

export const artifactPlacementResourcePermission: ResourcePermission = {
  actions: {
    create: {
      all: [
        { rel: 'artifact', action: 'read' },
        { rel: 'containerArtifact', action: 'operate' },
      ],
    },
    delete: { rel: 'containerArtifact', action: 'operate' },
    read: { rel: 'artifact', action: 'read' },
  },
};

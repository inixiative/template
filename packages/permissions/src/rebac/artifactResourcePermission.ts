/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz, feature:files
 * @uses none
 */
import { DateOperator, Operator } from '@inixiative/json-rules';
import { makeKindRules } from '@inixiative/permissions';
import { ArtifactKind, type Role } from '@template/db/generated/client/enums';
import { schemaMapWithoutPermissions } from '@template/db/schemaMap';
import {
  actorMayPerformActionOnOwner,
  actorOperatesOwnerUserOrManagesOwnerTenant,
  isNull,
  operatesAtItsMembersTenant,
  ownerModelIsOneOf,
  roleHeldVia,
  rowIsThereAnd,
} from '@template/permissions/rebac/rebacSchemaRules';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';
import { roleHierarchy } from '@template/permissions/roles/shared';

const kind = makeKindRules(schemaMapWithoutPermissions);

type StandardAction = 'own' | 'manage' | 'operate' | 'read';

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

const granteeIs = (granteeModel: string, prefix = 'permission.'): ActionRule => ({
  rule: { field: `${prefix}granteeModel`, operator: Operator.equals, value: granteeModel },
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

const ownerTenantRead = (at = ''): ActionRule => ({
  any: [
    {
      all: [ownerModelIsOneOf(['Organization'], at), { rel: `${at}organization`, action: 'read' }],
    },
    { all: [ownerModelIsOneOf(['Space'], at), { rel: `${at}space`, action: 'read' }] },
    {
      all: [
        ownerModelIsOneOf(['OrganizationUser'], at),
        { rel: `${at}organizationUser.organization`, action: 'read' },
      ],
    },
    {
      all: [ownerModelIsOneOf(['SpaceUser'], at), { rel: `${at}spaceUser.space`, action: 'read' }],
    },
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

const artifactOwnerOperate: ActionRule = {
  any: [
    actorOperatesOwnerUserOrManagesOwnerTenant,
    {
      all: [
        ownerModelIsOneOf(['OrganizationUser', 'SpaceUser']),
        actorMayPerformActionOnOwner('operate', '', ['OrganizationUser', 'SpaceUser']),
        operatesAtItsMembersTenant,
      ],
    },
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
        artifactIsTenant,
      ],
    },
    create: artifactOwnerOperate,
  },
};

const artifactPermissionRoleWrite: ActionRule = {
  all: [
    { rel: 'artifact', action: 'manage' },
    roleHeldVia((action) => ({ rel: 'artifact', action })),
  ],
};

const artifactPermissionGranteeLeave: ActionRule = {
  any: [
    { all: [granteeIs('User', ''), { rel: 'granteeUser', action: 'operate' }] },
    { all: [granteeIs('Organization', ''), { rel: 'granteeOrganization', action: 'manage' }] },
    { all: [granteeIs('Space', ''), { rel: 'granteeSpace', action: 'manage' }] },
    {
      all: [
        granteeIs('OrganizationUser', ''),
        { rel: 'granteeOrganizationUser', action: 'operate' },
      ],
    },
    { all: [granteeIs('SpaceUser', ''), { rel: 'granteeSpaceUser', action: 'operate' }] },
    {
      all: [
        granteeIs('CustomerRelationship', ''),
        {
          any: [
            { rel: 'granteeCustomerRelationship.customerUser', action: 'operate' },
            { rel: 'granteeCustomerRelationship.customerOrganization', action: 'manage' },
            { rel: 'granteeCustomerRelationship.customerSpace', action: 'manage' },
          ],
        },
      ],
    },
  ],
};

const artifactPermissionGranteeRead: ActionRule = {
  any: [
    { all: [granteeIs('User', ''), { rel: 'granteeUser', action: 'read' }] },
    { all: [granteeIs('Organization', ''), { rel: 'granteeOrganization', action: 'read' }] },
    { all: [granteeIs('Space', ''), { rel: 'granteeSpace', action: 'read' }] },
    {
      all: [
        granteeIs('OrganizationUser', ''),
        { rel: 'granteeOrganizationUser', action: 'operate' },
      ],
    },
    { all: [granteeIs('SpaceUser', ''), { rel: 'granteeSpaceUser', action: 'operate' }] },
    {
      all: [
        granteeIs('CustomerRelationship', ''),
        {
          any: [
            { rel: 'granteeCustomerRelationship.customerUser', action: 'read' },
            { rel: 'granteeCustomerRelationship.customerOrganization', action: 'read' },
            { rel: 'granteeCustomerRelationship.customerSpace', action: 'read' },
          ],
        },
      ],
    },
  ],
};

export const artifactPermissionResourcePermission: ResourcePermission = {
  actions: {
    manage: artifactPermissionRoleWrite,
    read: {
      any: [
        'manage',
        'leave',
        artifactPermissionGranteeRead,
        { rel: 'artifact', action: 'manage' },
      ],
    },
    create: artifactPermissionRoleWrite,
    leave: artifactPermissionGranteeLeave,
    delete: { any: ['leave', artifactPermissionRoleWrite] },
  },
};

const containerIsRoot: ActionRule = {
  rule: { field: 'containerArtifact.kind', operator: Operator.equals, value: ArtifactKind.root },
};

const containerIsNotRoot: ActionRule = {
  rule: { field: 'containerArtifact.kind', operator: Operator.in, value: nonRootArtifactKinds },
};

const containerOwnerRead: ActionRule = {
  any: [
    { rel: 'containerArtifact', action: 'manage' },
    actorMayPerformActionOnOwner('read', 'containerArtifact.', ['User']),
    actorMayPerformActionOnOwner('own', 'containerArtifact.', ['OrganizationUser', 'SpaceUser']),
  ],
};

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
        {
          all: [
            { rule: { field: 'access', operator: Operator.in, value: ['inherit', 'public'] } },
            { rel: 'containerArtifact', action: 'operate' },
          ],
        },
        {
          all: [
            { rule: { field: 'access', operator: Operator.equals, value: 'tenant' } },
            {
              any: [
                { rel: 'containerArtifact', action: 'manage' },
                {
                  all: [
                    { rel: 'containerArtifact', action: 'operate' },
                    ownerTenantRead('containerArtifact.'),
                  ],
                },
              ],
            },
          ],
        },
        {
          all: [
            { rule: { field: 'access', operator: Operator.equals, value: 'private' } },
            { rel: 'containerArtifact', action: 'manage' },
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
                {
                  all: [
                    containerIsRoot,
                    {
                      any: [
                        { rule: { field: 'access', operator: Operator.equals, value: 'public' } },
                        {
                          all: [
                            {
                              rule: { field: 'access', operator: Operator.equals, value: 'tenant' },
                            },
                            ownerTenantRead('containerArtifact.'),
                          ],
                        },
                        containerOwnerRead,
                      ],
                    },
                  ],
                },
                {
                  all: [
                    containerIsNotRoot,
                    { rel: 'containerArtifact', action: 'read' },
                    {
                      any: [
                        {
                          rule: {
                            field: 'access',
                            operator: Operator.in,
                            value: ['inherit', 'public'],
                          },
                        },
                        {
                          all: [
                            {
                              rule: { field: 'access', operator: Operator.equals, value: 'tenant' },
                            },
                            {
                              any: [ownerTenantRead('containerArtifact.'), containerOwnerRead],
                            },
                          ],
                        },
                        {
                          all: [
                            {
                              rule: {
                                field: 'access',
                                operator: Operator.equals,
                                value: 'private',
                              },
                            },
                            containerOwnerRead,
                          ],
                        },
                      ],
                    },
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

/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import {
  ContactSource,
  IntegrationResourceStatus,
  OperateAccess,
  ReadAccess,
} from '@template/db/generated/client/enums';
import { schemaMapWithoutPermissions } from '@template/db/schemaMap';
import { inquiryResourcePermission } from '@template/permissions/rebac/inquiryResourcePermission';
import {
  actorIsDelegateOfUser,
  actorIsUser,
  actorMayCreateTokenAtOwnerWithRole,
  actorMayPerformActionOnOwner,
  actorOperatesOwnerUserOrManagesOwnerTenant,
  chainedStandardActions,
  integrationAccess,
  integrationAdministering,
  isNull,
  memberRowActions,
  ownerActions,
  ownerPrivateRead,
  ownerTenant,
  rowIsThereAnd,
  tokenAdministering,
} from '@template/permissions/rebac/rebacSchemaRules';
import { settingResourcePermission } from '@template/permissions/rebac/settingResourcePermission';
import type { ActionRule, SchemaMap } from '@template/permissions/rebac/types';
import { omit } from 'lodash-es';

export const schemaMap: SchemaMap = {
  ...schemaMapWithoutPermissions,
  permissions: {
    'db:User': {
      actions: {
        own: null,
        manage: 'own',
        operate: 'manage',
        read: 'operate',
        delegateFull: { all: [actorIsUser, 'own'] },
        'user.rotateJwts': { all: [actorIsUser, 'operate'] },
        'user.changePassword': { all: [actorIsUser, 'operate'] },
        'user.manageTwoFactor': { all: [actorIsUser, 'own'] },
        'user.redact': { all: [actorIsUser, 'own'] },
      },
    },

    'db:Organization': {
      actions: {
        own: null,
        manage: 'own',
        operate: 'manage',
        read: 'operate',
        create: { any: [actorIsUser, actorIsDelegateOfUser] },
        delete: { all: [actorIsUser, 'own'] },
      },
    },

    'db:Space': {
      actions: {
        own: { rel: 'organization', action: 'own' },
        manage: 'own',
        operate: 'manage',
        read: 'operate',
      },
    },

    // Owner-polymorphic models: per-row permissionRules are merged additively
    // over the standard owner-walk by check() — see packages/permissions/src/rebac/rebacSchemaRules.ts.
    // Contact: the email made at user creation to mirror the login (source userCreation) is
    // locked against manage (update/delete both gate on manage) — it stays in sync
    // with auth, never edited directly. Every other contact takes the owner walk.
    'db:Contact': {
      actions: {
        ...ownerActions(),
        manage: {
          all: [
            {
              any: [
                rowIsThereAnd('id', isNull('source')),
                {
                  rule: {
                    field: 'source',
                    operator: Operator.in,
                    value: Object.values(omit(ContactSource, ContactSource.userCreation)),
                  },
                },
              ],
            },
            ownerActions().manage,
          ],
        },
        create: {
          any: [
            { rel: 'user', action: 'operate' },
            { rel: 'organization', action: 'manage' },
            { rel: 'space', action: 'manage' },
          ],
        },
      },
    },
    'db:WebhookSubscription': { actions: { ...ownerActions(), create: 'operate' } },
    'db:Segment': {
      actions: { ...ownerActions(), create: actorOperatesOwnerUserOrManagesOwnerTenant },
    },
    'db:SegmentMember': {
      actions: chainedStandardActions({
        own: { rel: 'segment', action: 'own' },
        manage: { rel: 'segment', action: 'manage' },
        operate: { rel: 'segment', action: 'operate' },
        read: { rel: 'segment', action: 'read' },
      }),
    },
    'db:Integration': { actions: { ...integrationAdministering, ...integrationAccess } },
    'db:IntegrationResource': {
      actions: {
        manage: { rel: 'integration', action: 'manage' },
        operate: { any: ['manage', { rel: 'integration', action: 'operate' }] },
        read: { any: ['operate', { rel: 'integration', action: 'read' }] },
        create: 'manage',
        delete: { any: ['manage', { rel: 'integration', action: 'delete' }] },
      },
    },
    'db:Project': {
      actions: {
        ...omit(integrationAdministering, 'delegateFull'),
        operate: {
          any: [
            'manage',
            actorMayPerformActionOnOwner('operate', '', ['User']),
            {
              all: [
                {
                  rule: {
                    field: 'operateAccess',
                    operator: Operator.equals,
                    value: OperateAccess.tenant,
                  },
                },
                ownerTenant('operate'),
              ],
            },
          ],
        },
        read: {
          any: [
            'operate',
            ownerPrivateRead(),
            { rule: { field: 'readAccess', operator: Operator.equals, value: ReadAccess.public } },
            {
              all: [
                {
                  rule: {
                    field: 'readAccess',
                    operator: Operator.equals,
                    value: ReadAccess.tenant,
                  },
                },
                ownerTenant('read'),
              ],
            },
          ],
        },
      },
    },
    'db:ProjectIntegration': {
      actions: {
        create: {
          all: [
            { rel: 'project', action: 'manage' },
            { rel: 'integration', action: 'operate' },
          ],
        },
        manage: { rel: 'project', action: 'manage' },
        operate: { any: ['manage', { rel: 'project', action: 'operate' }] },
        read: { any: ['operate', { rel: 'project', action: 'read' }] },
        delete: {
          any: [
            { rel: 'project', action: 'manage' },
            { rel: 'integration', action: 'manage' },
          ],
        },
      },
    },
    'db:ProjectIntegrationResource': {
      actions: {
        create: {
          all: [
            { rel: 'project', action: 'manage' },
            { rel: 'integrationResource', action: 'operate' },
            {
              rule: {
                field: 'integrationResource.status',
                operator: Operator.in,
                value: [IntegrationResourceStatus.tracked, IntegrationResourceStatus.missing],
              },
            },
          ],
        },
        delete: {
          any: [
            { rel: 'project', action: 'manage' },
            { rel: 'integrationResource', action: 'manage' },
          ],
        },
        read: { rel: 'project', action: 'read' },
      },
    },
    'db:Setting': settingResourcePermission,
    'db:Flow': { actions: { ...ownerActions(['user']), create: 'operate' } },

    'db:OrganizationUser': { actions: memberRowActions('organization') },

    'db:SpaceUser': { actions: memberRowActions('space') },

    'db:Token': {
      actions: {
        leave: { rel: 'user', action: 'operate' },
        read: { any: ['leave', tokenAdministering] },
        create: { all: [actorIsUser, actorMayCreateTokenAtOwnerWithRole] },
        delete: { any: ['leave', tokenAdministering] },
      },
    },

    'db:AuthProvider': {
      actions: {
        own: { rel: 'organization', action: 'own' },
        create: 'own',
      },
    },
    'db:Inquiry': inquiryResourcePermission,
  },
};

/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import { ContactSource, InquiryType } from '@template/db/generated/client/enums';
import {
  actionOnOwner,
  actorIsDelegateOfUser,
  actorIsUser,
  chainedStandardActions,
  createdByItsUserOrManager,
  highRoles,
  integrationAccess,
  integrationAdministering,
  lowRoles,
  memberRowActions,
  ownerActions,
  tokenAccessIsYours,
  tokenAdministering,
} from '@template/permissions/rebac/schemaHelpers';
import type { RebacSchema } from '@template/permissions/rebac/types';
import { omit } from 'lodash-es';

export const rebacSchema: RebacSchema = {
  bridges: [],
  permissions: {
    'db:user': {
      actions: {
        own: null,
        manage: 'own',
        operate: 'manage',
        read: 'operate',
        delegateFull: { all: [actorIsUser, 'own'] },
        'user.rotateJwts': { all: [actorIsUser, 'operate'] },
        'user.changePassword': { all: [actorIsUser, 'operate'] },
        'user.redact': { all: [actorIsUser, 'own'] },
      },
    },

    'db:organization': {
      actions: {
        own: null,
        manage: 'own',
        operate: 'manage',
        read: 'operate',
        create: { any: [actorIsUser, actorIsDelegateOfUser] },
        delete: { all: [actorIsUser, 'own'] },
      },
    },

    'db:space': {
      actions: {
        own: { rel: 'organization', action: 'own' },
        manage: 'own',
        operate: 'manage',
        read: 'operate',
      },
    },

    // Owner-polymorphic models: per-row permissionRules are merged additively
    // over the standard owner-walk by check() — see packages/permissions/src/rebac/schemaHelpers.ts.
    // Contact: the email made at user creation to mirror the login (source userCreation) is
    // locked against manage (update/delete both gate on manage) — it stays in sync
    // with auth, never edited directly. Every other contact takes the owner walk.
    'db:contact': {
      actions: {
        ...ownerActions(),
        manage: {
          all: [
            {
              any: [
                { rule: { field: 'source', operator: Operator.equals, value: null } },
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
    'db:webhookSubscription': { actions: { ...ownerActions(), create: 'operate' } },
    'db:segment': {
      actions: { ...ownerActions(), create: createdByItsUserOrManager },
    },
    'db:segmentMember': {
      actions: chainedStandardActions({
        own: { rel: 'segment', action: 'own' },
        manage: { rel: 'segment', action: 'manage' },
        operate: { rel: 'segment', action: 'operate' },
        read: { rel: 'segment', action: 'read' },
      }),
    },
    'db:integration': { actions: { ...integrationAdministering, ...integrationAccess } },
    'db:flow': { actions: { ...ownerActions(['user']), create: 'operate' } },

    'db:organizationUser': { actions: memberRowActions('organization') },

    'db:spaceUser': { actions: memberRowActions('space') },

    'db:token': {
      actions: {
        leave: { rel: 'user', action: 'operate' },
        read: { any: ['leave', tokenAdministering] },
        create: { all: [actorIsUser, tokenAccessIsYours] },
        delete: { any: ['leave', tokenAdministering] },
      },
    },

    'db:authProvider': {
      actions: {
        own: { rel: 'organization', action: 'own' },
        create: 'own',
      },
    },

    'db:inquiry': {
      actions: {
        // Read: source or target can read their own inquiry
        read: {
          any: [
            { rel: 'sourceUser', action: 'read' },
            { rel: 'sourceOrganization', action: 'manage' },
            { rel: 'sourceSpace', action: 'manage' },
            { rel: 'targetUser', action: 'read' },
            { rel: 'targetOrganization', action: 'manage' },
            { rel: 'targetSpace', action: 'manage' },
          ],
        },

        // Send: who may create/initiate each inquiry type
        send: {
          any: [
            // Source user can act on their own inquiry (cancel, edit, re-send)
            // Add type strings here when user-sourced inquiry types exist
            {
              all: [
                { rule: { field: 'type', operator: Operator.in, value: [] } },
                { rel: 'sourceUser', action: 'operate' },
              ],
            },
            // inviteOrganizationUser: high roles (owner/admin) require own
            {
              all: [
                {
                  rule: { field: 'type', operator: Operator.in, value: ['inviteOrganizationUser'] },
                },
                { rule: { field: 'content.role', operator: Operator.in, value: highRoles } },
                { rel: 'sourceOrganization', action: 'own' },
              ],
            },
            // inviteOrganizationUser: normal roles require manage
            {
              all: [
                {
                  rule: { field: 'type', operator: Operator.in, value: ['inviteOrganizationUser'] },
                },
                {
                  any: [
                    { rule: { field: 'content.role', operator: Operator.in, value: lowRoles } },
                    { rule: { field: 'content.role', operator: Operator.equals, value: null } },
                  ],
                },
                { rel: 'sourceOrganization', action: 'manage' },
              ],
            },
            // createSpace — org owner only
            {
              all: [
                { rule: { field: 'type', operator: Operator.in, value: ['createSpace'] } },
                { rel: 'sourceOrganization', action: 'own' },
              ],
            },
            // updateSpace — space owner or org owner (sourceSpace.own delegates to org.own)
            {
              all: [
                { rule: { field: 'type', operator: Operator.in, value: ['updateSpace'] } },
                { rel: 'sourceSpace', action: 'own' },
              ],
            },
            // transferSpace — org owner only (explicit 2-hop traversal bypasses direct space.own)
            {
              all: [
                { rule: { field: 'type', operator: Operator.in, value: ['transferSpace'] } },
                { rel: 'sourceSpace.organization', action: 'own' },
              ],
            },
          ],
        },

        // Resolve: target decides (approve/deny/requestChanges)
        resolve: {
          any: [
            { rel: 'targetUser', action: 'operate' },
            {
              any: [
                // transferSpace — target org owner only
                {
                  all: [
                    { rule: { field: 'type', operator: Operator.in, value: ['transferSpace'] } },
                    { rel: 'targetOrganization', action: 'own' },
                  ],
                },
                // all other types — target org manager
                {
                  all: [
                    {
                      rule: {
                        field: 'type',
                        operator: Operator.in,
                        value: Object.values(omit(InquiryType, InquiryType.transferSpace)),
                      },
                    },
                    { rel: 'targetOrganization', action: 'manage' },
                  ],
                },
              ],
            },
            { rel: 'targetSpace', action: 'manage' },
          ],
        },
      },
    },
  },
};

/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import {
  actionOnOwner,
  actorIsDelegateOfUser,
  actorIsUser,
  assignActions,
  createdByItsUserOrManager,
  delegateHoldsOperate,
  highRoles,
  integrationAccess,
  integrationAdministering,
  managedUpTheChain,
  ownerActions,
  tokenAccessIsYours,
} from '@template/permissions/rebac/schemaHelpers';
import type { RebacSchema } from '@template/permissions/rebac/types';

export const rebacSchema: RebacSchema = {
  bridges: [],
  permissions: {
    'db:user': {
      actions: {
        own: null,
        manage: 'own',
        operate: 'manage',
        read: 'operate',
        'user.rotateJwts': { all: [actorIsUser, 'operate'] },
        'user.redact': { all: [actorIsUser, 'own'] },
      },
    },

    'db:organization': {
      actions: {
        own: null,
        manage: 'own',
        operate: 'manage',
        read: 'operate',
        create: { any: [actorIsUser, { all: [actorIsDelegateOfUser, delegateHoldsOperate] }] },
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
    // Contact: the email mirroring the user's login (valueKey === user.email) is
    // locked against manage (update/delete both gate on manage) — it stays in sync
    // with auth, never edited directly. Every other contact takes the owner walk.
    'db:contact': {
      actions: {
        ...ownerActions(),
        manage: {
          all: [
            { rule: { field: 'valueKey', operator: Operator.notEquals, path: 'user.email' } },
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
      actions: {
        own: { rel: 'segment', action: 'own' },
        manage: { rel: 'segment', action: 'manage' },
        operate: { rel: 'segment', action: 'operate' },
        read: { rel: 'segment', action: 'read' },
      },
    },
    'db:integration': { actions: { ...integrationAdministering, ...integrationAccess } },
    'db:flow': { actions: { ...ownerActions(['user']), create: 'operate' } },

    'db:organizationUser': {
      actions: {
        read: {
          any: [
            { rel: 'user', action: 'read' },
            { rel: 'organization', action: 'read' },
          ],
        },
        leave: { rel: 'user', action: 'operate' },
        operate: { rel: 'organization', action: 'operate' },
        manage: { rel: 'organization', action: 'manage' },
        own: { rel: 'organization', action: 'own' },
        ...assignActions(
          { rel: 'organization', action: 'own' },
          { rel: 'organization', action: 'manage' },
        ),
      },
    },

    'db:spaceUser': {
      actions: {
        read: {
          any: [
            { rel: 'user', action: 'read' },
            { rel: 'space', action: 'read' },
          ],
        },
        leave: { rel: 'user', action: 'operate' },
        operate: { rel: 'space', action: 'operate' },
        manage: { rel: 'space', action: 'manage' },
        own: { rel: 'space', action: 'own' },
        ...assignActions({ rel: 'space', action: 'own' }, { rel: 'space', action: 'manage' }),
      },
    },

    'db:token': {
      actions: {
        leave: { rel: 'user', action: 'operate' },
        own: actionOnOwner('own'),
        read: 'own',
        create: { all: [actorIsUser, tokenAccessIsYours] },
        delete: { all: [actorIsUser, { any: ['leave', managedUpTheChain] }] },
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
                { rule: { field: 'content.role', operator: Operator.notIn, value: highRoles } },
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
                    { rule: { field: 'type', operator: Operator.notIn, value: ['transferSpace'] } },
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

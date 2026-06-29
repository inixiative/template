/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import { ownerActions } from '@template/permissions/rebac/ownerActions';
import type { RebacSchema } from '@template/permissions/rebac/types';

const highRoles = ['owner', 'admin'];

export const rebacSchema: RebacSchema = {
  bridges: [],
  permissions: {
    'db:user': {
      actions: {
        own: null,
        manage: 'own',
        operate: 'manage',
        read: 'operate',
      },
    },

    'db:organization': {
      actions: {
        own: null,
        manage: 'own',
        operate: 'manage',
        read: 'operate',
        // Role assignment: high roles need own, others need manage
        assign: {
          any: [
            { all: [{ rule: { field: 'role', operator: Operator.in, value: highRoles } }, 'own'] },
            { all: [{ rule: { field: 'role', operator: Operator.notIn, value: highRoles } }, 'manage'] },
          ],
        },
      },
    },

    'db:space': {
      actions: {
        own: { rel: 'organization', action: 'own' },
        manage: 'own',
        operate: 'manage',
        read: 'operate',
        assign: {
          any: [
            { all: [{ rule: { field: 'role', operator: Operator.in, value: highRoles } }, 'own'] },
            { all: [{ rule: { field: 'role', operator: Operator.notIn, value: highRoles } }, 'manage'] },
          ],
        },
      },
    },

    // Owner-polymorphic models: per-row permissionRules are merged additively
    // over the standard owner-walk by check() — see packages/permissions/src/rebac/ownerActions.ts.
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
      },
    },
    'db:webhookSubscription': { actions: ownerActions() },

    'db:organizationUser': {
      actions: {
        read: { any: [{ self: 'userId' }, { rel: 'organization', action: 'read' }] },
        leave: { self: 'userId' },
        manage: { rel: 'organization', action: 'manage' },
        own: { rel: 'organization', action: 'own' },
      },
    },

    'db:spaceUser': {
      actions: {
        read: { any: [{ self: 'userId' }, { rel: 'space', action: 'read' }] },
        leave: { self: 'userId' },
        manage: { rel: 'space', action: 'manage' },
        own: { rel: 'space', action: 'own' },
      },
    },

    // Tokens carry a `role` field — assigning/revoking one inherits the
    // org/space `assign` semantics: high roles need own on the owner, others
    // need manage. Encoded against the token's row so the role rule resolves
    // locally and only the seat check walks to the owner.
    'db:token': {
      actions: {
        // Self-delete for tokens with a userId (User, OrgUser, SpaceUser).
        leave: { self: 'userId' },
        // Owner-side assign, role-aware.
        assign: {
          any: [
            {
              all: [
                { rule: { field: 'role', operator: Operator.in, value: highRoles } },
                {
                  any: [
                    { rel: 'organization', action: 'own' },
                    { rel: 'space', action: 'own' },
                  ],
                },
              ],
            },
            {
              all: [
                { rule: { field: 'role', operator: Operator.notIn, value: highRoles } },
                {
                  any: [
                    { rel: 'organization', action: 'manage' },
                    { rel: 'space', action: 'manage' },
                  ],
                },
              ],
            },
          ],
        },
      },
    },

    'db:authProvider': {
      actions: {
        own: { rel: 'organization', action: 'own' },
      },
    },

    'db:inquiry': {
      actions: {
        // Read: source or target can read their own inquiry
        read: {
          any: [
            { self: 'sourceUserId' },
            { rel: 'sourceOrganization', action: 'manage' },
            { rel: 'sourceSpace', action: 'manage' },
            { self: 'targetUserId' },
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
              all: [{ rule: { field: 'type', operator: Operator.in, value: [] } }, { self: 'sourceUserId' }],
            },
            // inviteOrganizationUser: high roles (owner/admin) require own
            {
              all: [
                { rule: { field: 'type', operator: Operator.in, value: ['inviteOrganizationUser'] } },
                { rule: { field: 'content.role', operator: Operator.in, value: highRoles } },
                { rel: 'sourceOrganization', action: 'own' },
              ],
            },
            // inviteOrganizationUser: normal roles require manage
            {
              all: [
                { rule: { field: 'type', operator: Operator.in, value: ['inviteOrganizationUser'] } },
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
        // For User targets: self check passes. For admin targets (targetModel === admin),
        // self check fails for regular users — superadmin bypass handles it.
        resolve: {
          any: [
            { self: 'targetUserId' },
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

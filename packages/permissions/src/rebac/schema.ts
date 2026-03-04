import { Operator } from '@inixiative/json-rules';
import type { RebacSchema } from '@template/permissions/rebac/types';

const highRoles = ['owner', 'admin'];
const spaceSourceTypes = ['updateSpace', 'transferSpace'];

export const rebacSchema: RebacSchema = {
  user: {
    actions: {
      own: null,
      manage: 'own',
      operate: 'manage',
      read: 'operate',
    },
  },

  organization: {
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

  space: {
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

  organizationUser: {
    actions: {
      read: { any: [{ self: 'userId' }, { rel: 'organization', action: 'read' }] },
      leave: { self: 'userId' },
      manage: { rel: 'organization', action: 'manage' },
      own: { rel: 'organization', action: 'own' },
    },
  },

  spaceUser: {
    actions: {
      read: { any: [{ self: 'userId' }, { rel: 'space', action: 'read' }] },
      leave: { self: 'userId' },
      manage: { rel: 'space', action: 'manage' },
      own: { rel: 'space', action: 'own' },
    },
  },

  token: {
    actions: {
      // Self-delete for tokens with userId (User, OrgUser, SpaceUser)
      leave: { self: 'userId' },
    },
  },

  authProvider: {
    actions: {
      own: { rel: 'organization', action: 'own' },
    },
  },

  inquiry: {
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
          // createSpace — any org member may request
          {
            all: [
              { rule: { field: 'type', operator: Operator.in, value: ['createSpace'] } },
              { rel: 'sourceOrganization', action: 'operate' },
            ],
          },
          // updateSpace, transferSpace — space admin+ may request
          {
            all: [
              { rule: { field: 'type', operator: Operator.in, value: spaceSourceTypes } },
              { rel: 'sourceSpace', action: 'manage' },
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
          { rel: 'targetOrganization', action: 'manage' },
          { rel: 'targetSpace', action: 'manage' },
        ],
      },
    },
  },
};

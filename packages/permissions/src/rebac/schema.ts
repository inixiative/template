import { Operator } from '@inixiative/json-rules';
import type { RebacSchema } from '@template/permissions/rebac/types';

const highRoles = ['owner', 'admin'];

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
};

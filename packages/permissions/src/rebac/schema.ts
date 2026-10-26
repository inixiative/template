/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import { ownerActions } from '@template/permissions/rebac/ownerActions';
import type { ActionRule, RebacSchema } from '@template/permissions/rebac/types';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';

const highRoles = ['owner', 'admin'];
const actorIsUser: ActionRule = {
  rule: { field: '__actor.model', operator: Operator.equals, value: 'User' },
};

const actorIsDelegateOfUser: ActionRule = {
  rule: { field: '__actor.record.ownerModel', operator: Operator.equals, value: 'User' },
};

const owners = [
  ['User', 'user'],
  ['Organization', 'organization'],
  ['OrganizationUser', 'organizationUser'],
  ['Space', 'space'],
  ['SpaceUser', 'spaceUser'],
  ['Integration', 'integration'],
] as const;

const onOwner = (action: string, at = ''): ActionRule => ({
  any: owners.map(([ownerModel, rel]) => ({
    all: [
      { rule: { field: `${at}ownerModel`, operator: Operator.equals, value: ownerModel } },
      { rel: `${at}${rel}`, action },
    ],
  })),
});

const actorIsItsUser = (at = ''): ActionRule => ({
  all: [
    { rule: { field: `${at}userId`, operator: Operator.notEmpty, value: true } },
    {
      any: [
        {
          all: [
            actorIsUser,
            {
              rule: { field: `${at}userId`, operator: Operator.equals, path: '__actor.record.id' },
            },
          ],
        },
        {
          all: [
            actorIsDelegateOfUser,
            {
              rule: {
                field: `${at}userId`,
                operator: Operator.equals,
                path: '__actor.record.userId',
              },
            },
          ],
        },
      ],
    },
    { rel: `${at}user`, action: 'manage' },
  ],
});

const ownedByOrganizationOrSpace = (at = ''): ActionRule => ({
  rule: { field: `${at}ownerModel`, operator: Operator.in, value: ['Organization', 'Space'] },
});

const ownedByIntegration: ActionRule = {
  rule: { field: 'ownerModel', operator: Operator.equals, value: 'Integration' },
};

const notOwnedByIntegration: ActionRule = {
  rule: { field: 'ownerModel', operator: Operator.notEquals, value: 'Integration' },
};

const highRole: ActionRule = {
  rule: { field: 'role', operator: Operator.in, value: highRoles },
};

const assignRole = (own: ActionRule, manage: ActionRule): ActionRule => ({
  any: [
    { all: [highRole, own] },
    {
      all: [{ rule: { field: 'role', operator: Operator.notIn, value: highRoles } }, manage],
    },
  ],
});

const heldAtOwner = (at = ''): ActionRule => ({
  any: [
    {
      all: [
        { rule: { field: 'role', operator: Operator.equals, value: null } },
        onOwner('read', at),
      ],
    },
    ...roleHierarchy.map((role) => ({
      all: [
        { rule: { field: 'role', operator: Operator.equals, value: role } },
        onOwner(roleToStandardAction(role), at),
      ],
    })),
  ],
});

const yoursOrOrganizationOrSpace = (at = ''): ActionRule => ({
  any: [ownedByOrganizationOrSpace(at), actorIsItsUser(at)],
});

const ownedByUser: ActionRule = {
  rule: { field: 'ownerModel', operator: Operator.equals, value: 'User' },
};

const integrationAdministering = {
  create: {
    any: [
      { all: [ownedByUser, { rel: 'user', action: 'operate' }] },
      { all: [ownedByOrganizationOrSpace(), onOwner('manage')] },
    ],
  },
  own: { any: [actorIsItsUser(), { all: [ownedByOrganizationOrSpace(), onOwner('own')] }] },
  manage: {
    any: [actorIsItsUser(), { all: [ownedByOrganizationOrSpace(), onOwner('manage')] }],
  },
} satisfies Record<string, ActionRule>;

const integrationAccess = {
  operate: onOwner('operate'),
  read: onOwner('read'),
  assign: {
    any: [
      { all: [ownedByOrganizationOrSpace(), assignRole(onOwner('own'), onOwner('manage'))] },
      { all: [actorIsItsUser(), heldAtOwner()] },
    ],
  },
} satisfies Record<string, ActionRule>;

const tokenAccessIsYours: ActionRule = {
  any: [
    { all: [notOwnedByIntegration, heldAtOwner(), yoursOrOrganizationOrSpace()] },
    {
      all: [
        ownedByIntegration,
        heldAtOwner('integration.'),
        yoursOrOrganizationOrSpace('integration.'),
      ],
    },
  ],
};

const managedUpTheChain: ActionRule = {
  any: [
    { all: [notOwnedByIntegration, onOwner('manage')] },
    { all: [ownedByIntegration, onOwner('manage', 'integration.')] },
  ],
};

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
        create: { any: [actorIsUser, actorIsDelegateOfUser] },
        delete: { all: [actorIsUser, 'own'] },
        assign: 'own',
      },
    },

    'db:space': {
      actions: {
        own: { rel: 'organization', action: 'own' },
        manage: 'own',
        operate: 'manage',
        read: 'operate',
        assign: 'own',
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
    'db:segment': { actions: ownerActions() },
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
        assign: {
          any: [
            assignRole(
              { rel: 'organization', action: 'own' },
              { rel: 'organization', action: 'manage' },
            ),
            { rel: 'organization', action: 'assign' },
          ],
        },
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
        assign: {
          any: [
            assignRole({ rel: 'space', action: 'own' }, { rel: 'space', action: 'manage' }),
            { rel: 'space', action: 'assign' },
          ],
        },
      },
    },

    'db:token': {
      actions: {
        leave: { rel: 'user', action: 'operate' },
        own: onOwner('own'),
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

/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import { ContactSource } from '@template/db/generated/client/enums';
import { inquiry } from '@template/permissions/rebac/inquiryPermission';
import {
  actorIsDelegateOfUser,
  actorIsUser,
  administeredByOwnerKind,
  chainedStandardActions,
  createdByItsUserOrManager,
  integrationAccess,
  integrationAdministering,
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
    'db:project': { actions: administeredByOwnerKind },
    'db:flow': { actions: { ...ownerActions(['user']), create: 'operate' } },
    'db:featureFlag': { actions: ownerActions() },
    'db:featureFlagVariant': {
      actions: {
        own: { rel: 'featureFlag', action: 'own' },
        manage: { rel: 'featureFlag', action: 'manage' },
        operate: { rel: 'featureFlag', action: 'operate' },
        read: { rel: 'featureFlag', action: 'read' },
      },
    },

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
    'db:inquiry': inquiry,
  },
};

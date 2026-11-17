/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz, feature:inquiry
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import { actorIsUser, highRoles, lowRoles } from '@template/permissions/rebac/schemaHelpers';
import type { ActionRule } from '@template/permissions/rebac/types';

// A party that can stand on a side of an inquiry. `admin` is the platform (superadmin): it has no
// relation to check, so only a superadmin acts for it.
export type InquiryPartyModel = Exclude<InquiryResourceModel, 'admin'>;

// The level a party needs: an action of the party model's own resource, asked on its relation; or,
// for a case one action cannot say, a plain rebac rule (rel, any, all, rule), used as written.
// inquiryPermission.test.ts checks every relation, action and field either form names exists.
export type PartyLevel = string | Exclude<ActionRule, string>;

export type InquiryParty =
  | { model: InquiryPartyModel; send?: PartyLevel; resolve?: PartyLevel }
  | { model: 'admin' };

export type InquiryTypeParties = {
  sources: readonly InquiryParty[];
  targets: readonly InquiryParty[];
};

// Reading an inquiry is party-wide, whatever its type, and each party reads its own ownership
// channel only: a person reads the sides that name them (their own, their memberships', and what
// those hold); an organization reads, with manage, the sides on the organization alone (no space,
// no person); a space the sides on the space with no person (Aron, 2026-11-16). `clear` lists the
// side keys that must be empty. Sending and resolving are per type, below.
export const INQUIRY_READ_LEVELS: Partial<
  Record<InquiryPartyModel, { action: string; clear: readonly string[] }>
> = {
  User: { action: 'read', clear: [] },
  Organization: { action: 'manage', clear: ['SpaceId', 'UserId'] },
  Space: { action: 'manage', clear: ['UserId'] },
};

const role = (operator: Operator, value: string[] | null): ActionRule => ({
  rule: { field: 'content.role', operator, value },
});

// Who may stand on each side of each inquiry type, and the level each needs to send (source) or
// resolve (target). `db:inquiry` is built from this, and the API validates parties against it.
export const INQUIRY_TYPES = {
  inviteOrganizationUser: {
    sources: [
      {
        model: 'Organization',
        send: {
          any: [
            { all: [role(Operator.in, highRoles), { rel: 'sourceOrganization', action: 'own' }] },
            {
              all: [
                { any: [role(Operator.in, lowRoles), role(Operator.equals, null)] },
                { rel: 'sourceOrganization', action: 'manage' },
              ],
            },
          ],
        },
      },
    ],
    targets: [{ model: 'User', resolve: 'manage' }],
  },
  createSpace: {
    sources: [{ model: 'Organization', send: 'own' }],
    targets: [{ model: 'admin' }],
  },
  updateSpace: {
    sources: [{ model: 'Space', send: 'own' }],
    targets: [{ model: 'admin' }],
  },
  transferSpace: {
    sources: [{ model: 'Space', send: { rel: 'sourceSpace.organization', action: 'own' } }],
    targets: [{ model: 'Organization', resolve: 'own' }],
  },
  // Addressed to the record whose entitlements change. Only someone who can read that record asks,
  // so a stranger cannot probe ids or have its owner shown to them. Whoever administers it may answer (a token
  // has no manage; delete is its administering action); the handler then runs the direct routes'
  // own checks, so an approver who could not grant it gets the refusal and the inquiry stays open. A person
  // answers, never a token: a token may approve one day, for now it neither approves nor denies.
  changeEntitlements: {
    sources: [
      {
        model: 'User',
        send: {
          all: [
            { rel: 'sourceUser', action: 'operate' },
            {
              any: [
                { rel: 'targetToken', action: 'read' },
                { rel: 'targetIntegration', action: 'read' },
              ],
            },
          ],
        },
      },
    ],
    targets: [
      { model: 'Token', resolve: { all: [actorIsUser, { rel: 'targetToken', action: 'delete' }] } },
      {
        model: 'Integration',
        resolve: { all: [actorIsUser, { rel: 'targetIntegration', action: 'manage' }] },
      },
    ],
  },
} as const satisfies Record<InquiryType, InquiryTypeParties>;

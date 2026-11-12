/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz, feature:inquiry
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import { highRoles, lowRoles } from '@template/permissions/rebac/schemaHelpers';
import type { ActionRule } from '@template/permissions/rebac/types';

// A party that can stand on a side of an inquiry. `admin` is UserEvidence itself: it has no
// relation to check, so only a superadmin acts for it.
export type InquiryPartyModel = Exclude<InquiryResourceModel, 'admin'>;

// The level a party needs: an action of the party model's own resource, asked on its relation
// (inquiryPermission.test.ts checks every one exists); or, for a case one action cannot say, a plain
// rebac rule in the schema's own vocabulary (rel, any, all, rule), used as written.
export type PartyLevel = string | Exclude<ActionRule, string>;

export type InquiryParty =
  | { model: InquiryPartyModel; send?: PartyLevel; resolve?: PartyLevel }
  | { model: 'admin' };

export type InquiryTypeParties = {
  sources: readonly InquiryParty[];
  targets: readonly InquiryParty[];
};

// Reading an inquiry is party-wide, whatever its type: the person on a side reads it, and an
// organization or space reads what it sent and received with manage (the entitlement rulings,
// R74/R76). Sending and resolving are per type, below.
// Open: lower-level types may want an operator to read, possibly per type and side. Left
// party-wide because the received/sent lists filter by party in the query.
export const INQUIRY_READ_LEVELS: Partial<Record<InquiryPartyModel, string>> = {
  User: 'read',
  Organization: 'manage',
  Space: 'manage',
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
} as const satisfies Record<InquiryType, InquiryTypeParties>;

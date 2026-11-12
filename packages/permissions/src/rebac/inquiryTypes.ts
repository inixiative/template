/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz, feature:inquiry
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { InquiryResourceModel, InquiryType } from '@template/db/generated/client/enums';
import type { BaseActionOf, BaseResource } from '@template/permissions/rebac/schema';
import { highRoles, lowRoles } from '@template/permissions/rebac/schemaHelpers';
import type { ActionRule } from '@template/permissions/rebac/types';

// A party that can stand on a side of an inquiry. `admin` is UserEvidence itself: it has no
// relation to check, so only a superadmin acts for it.
export type InquiryPartyModel = Exclude<InquiryResourceModel, 'admin'>;

type ResourceOf<M extends InquiryPartyModel> = Extract<`db:${Uncapitalize<M>}`, BaseResource>;

// An action of the party model's own resource: the schema's vocabulary, checked at compile time.
export type PartyAction<M extends InquiryPartyModel> = BaseActionOf<ResourceOf<M>>;

// The level a party needs: one action; an action asked of a model the party relates to
// (`{ via: 'organization', model: 'Organization', action: 'own' }` on a Space); or an action
// chosen by a rule over the inquiry, first match winning in effect because the branches are ORed
// and each states its own condition.
export type PartyLevel<M extends InquiryPartyModel> =
  | PartyAction<M>
  | {
      [V in InquiryPartyModel]: { via: string; model: V; action: PartyAction<V> };
    }[InquiryPartyModel]
  | readonly { when: ActionRule; action: PartyAction<M> }[];

export type InquiryParty =
  | {
      [M in InquiryPartyModel]: { model: M; send?: PartyLevel<M>; resolve?: PartyLevel<M> };
    }[InquiryPartyModel]
  | { model: 'admin' };

export type InquiryTypeParties = {
  sources: readonly InquiryParty[];
  targets: readonly InquiryParty[];
};

// Reading an inquiry is party-wide, whatever its type: the person on a side reads it, and an
// organization or space reads what it sent and received with manage (the entitlement rulings,
// R74/R76). Sending and resolving are per type, below.
export const INQUIRY_READ_LEVELS: { [M in InquiryPartyModel]?: PartyAction<M> } = {
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
        send: [
          { when: role(Operator.in, highRoles), action: 'own' },
          {
            when: { any: [role(Operator.in, lowRoles), role(Operator.equals, null)] },
            action: 'manage',
          },
        ],
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
    sources: [
      { model: 'Space', send: { via: 'organization', model: 'Organization', action: 'own' } },
    ],
    targets: [{ model: 'Organization', resolve: 'own' }],
  },
} as const satisfies Record<InquiryType, InquiryTypeParties>;

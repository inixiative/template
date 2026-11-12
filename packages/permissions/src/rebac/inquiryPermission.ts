/**
 * @atlas
 * @kind constructor
 * @constructs inquiryPermission
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { InquiryType } from '@template/db/generated/client/enums';
import {
  INQUIRY_READ_LEVELS,
  INQUIRY_TYPES,
  type InquiryParty,
  type InquiryPartyModel,
  type InquiryTypeParties,
  type PartyLevel,
} from '@template/permissions/rebac/inquiryTypes';
import type { ActionRule, ResourcePermission } from '@template/permissions/rebac/types';

export type InquirySide = 'source' | 'target';
type Verb = 'send' | 'resolve';

const isType = (type: InquiryType): ActionRule => ({
  rule: { field: 'type', operator: Operator.equals, value: type },
});

const isPartyModel = (side: InquirySide, model: InquiryPartyModel): ActionRule => ({
  rule: { field: `${side}Model`, operator: Operator.equals, value: model },
});

// The party's relation on the inquiry is named for its side and model: sourceOrganization,
// targetUser, sourceSpaceUser. An action is asked on it; a rule is used as written.
const levelRule = (rel: string, level: PartyLevel): ActionRule =>
  typeof level === 'string' ? { rel, action: level } : level;

// The party's grant for one verb, gated on the inquiry naming that party model on that side.
// `admin`, and a party that does not declare the verb, grant nothing: only a superadmin passes.
export const inquiryPartyRule = (
  side: InquirySide,
  party: InquiryParty,
  verb: Verb,
): ActionRule | null => {
  if (party.model === 'admin') return null;
  const level = (party as Partial<Record<Verb, PartyLevel>>)[verb];
  if (!level) return null;
  return { all: [isPartyModel(side, party.model), levelRule(`${side}${party.model}`, level)] };
};

const sideRules = (side: InquirySide, parties: readonly InquiryParty[], verb: Verb): ActionRule[] =>
  parties.flatMap((party) => inquiryPartyRule(side, party, verb) ?? []);

const perType = (
  types: Record<InquiryType, InquiryTypeParties>,
  rulesFor: (parties: InquiryTypeParties) => ActionRule[],
): ActionRule => ({
  any: (Object.entries(types) as [InquiryType, InquiryTypeParties][]).map(([type, parties]) => ({
    all: [isType(type), { any: rulesFor(parties) }],
  })),
});

// db:inquiry, built from the party declarations: send is a source party's level for that type,
// resolve a target party's. Read is party-wide (INQUIRY_READ_LEVELS).
export const inquiryPermission = (
  types: Record<InquiryType, InquiryTypeParties>,
): ResourcePermission => ({
  actions: {
    send: perType(types, ({ sources }) => sideRules('source', sources, 'send')),
    resolve: perType(types, ({ targets }) => sideRules('target', targets, 'resolve')),
    read: {
      any: (['source', 'target'] as const).flatMap((side) =>
        (Object.entries(INQUIRY_READ_LEVELS) as [InquiryPartyModel, string][]).map(
          ([model, action]) => ({
            rel: `${side}${model}`,
            action,
          }),
        ),
      ),
    },
  },
});

export const inquiry = inquiryPermission(INQUIRY_TYPES);

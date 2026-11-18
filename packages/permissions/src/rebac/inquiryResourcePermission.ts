/**
 * @atlas
 * @kind constructor
 * @constructs inquiryResourcePermissionFromParties
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

const rulesGrantingRead = (side: InquirySide, model: InquiryPartyModel): ActionRule[] => {
  const level = INQUIRY_READ_LEVELS[model];
  if (!level) return [];
  const rel: ActionRule = { rel: `${side}${model}`, action: level.action };
  if (!level.clear.length) return [rel];
  return [
    {
      all: [
        ...level.clear.map((key) => ({
          rule: { field: `${side}${key}`, operator: Operator.equals, value: null },
        })),
        rel,
      ],
    },
  ];
};

// db:inquiry, built from the party declarations: send is a source party's level for that type,
// resolve a target party's. Read is party-wide (INQUIRY_READ_LEVELS).
export const inquiryResourcePermissionFromParties = (
  types: Record<InquiryType, InquiryTypeParties>,
): ResourcePermission => ({
  actions: {
    send: perType(types, ({ sources }) => sideRules('source', sources, 'send')),
    resolve: perType(types, ({ targets }) => sideRules('target', targets, 'resolve')),
    read: {
      any: (['source', 'target'] as const).flatMap((side) =>
        (Object.keys(INQUIRY_READ_LEVELS) as InquiryPartyModel[]).flatMap((model) =>
          rulesGrantingRead(side, model),
        ),
      ),
    },
  },
});

export const inquiryResourcePermission = inquiryResourcePermissionFromParties(INQUIRY_TYPES);

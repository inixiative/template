/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { createLens, type FieldMap, type Lens, type LensNarrowing, validateNarrowing } from '@inixiative/json-rules';
import { RULE_REFERENCEABLE_MODELS } from '@template/db';
import { prismaMap } from '@template/db/generated/prismaMap';
import { omitForeignKeys } from '@template/db/lens';

export const EMAIL_RULE_CONTEXT = 'EmailRuleContext';

const emailRuleContextMap = {
  ...prismaMap,
  models: {
    ...prismaMap.models,
    [EMAIL_RULE_CONTEXT]: {
      fields: {
        recipient: { kind: 'object', type: 'User', isRequired: true, isList: false },
        sender: { kind: 'scalar', type: 'Json', isRequired: false, isList: false },
        data: { kind: 'scalar', type: 'Json', isRequired: false, isList: false },
      },
    },
  },
} as unknown as FieldMap;

export const emailRuleLens: Lens = createLens({
  maps: { prisma: emailRuleContextMap },
  mapName: 'prisma',
  model: EMAIL_RULE_CONTEXT,
});

const referenceableById = Object.fromEntries(
  RULE_REFERENCEABLE_MODELS.map((model) => [model, { sources: { id: { label: 'name' } } }]),
);

export const emailRuleNarrowing: LensNarrowing = omitForeignKeys({
  parent: emailRuleLens,
  mapDefaults: { prisma: { models: referenceableById } },
});

validateNarrowing(emailRuleNarrowing);

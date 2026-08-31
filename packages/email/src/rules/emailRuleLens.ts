/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { createLens, type FieldMap, type Lens, type LensNarrowing, validateNarrowing } from '@inixiative/json-rules';
import { prismaMap } from '@template/db/generated/prismaMap';

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

export const emailRuleNarrowing: LensNarrowing = {
  parent: emailRuleLens,
  root: {
    relations: {
      recipient: {
        relations: {
          tagAttachments: { relations: { tag: { sources: { id: true } } } },
          organizationUsers: { relations: { organization: { sources: { id: true } } } },
          spaceUsers: { relations: { space: { sources: { id: true } } } },
        },
      },
    },
  },
};

validateNarrowing(emailRuleNarrowing);

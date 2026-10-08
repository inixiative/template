/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */

import { RuleReferenceError, type RuleReferenceSource, syncRuleReferenceEdges } from '@template/db';
import type { EmailComponent, EmailTemplate } from '@template/db/generated/client/client';
import { stripComponentBodies } from '@template/email/render/stripComponentBodies';
import { defaultEmailLens, type EmailLens } from '@template/email/rules/emailLens';
import {
  contentDynamicRuleReferences,
  contentReferenceScopes,
  contentRuleReferences,
} from '@template/email/rules/ruleReferences';

export const syncRuleReferences = (
  source: RuleReferenceSource,
  contents: string[],
  lens: EmailLens | undefined,
  mode: 'save' | 'rebuild' = 'save',
) => {
  const judged = lens ?? defaultEmailLens;
  if (mode === 'save') {
    const [dynamic] = contentDynamicRuleReferences(judged, ...contents);
    if (dynamic)
      throw new RuleReferenceError(
        `rule names a ${dynamic.model} by a value read at evaluation (${dynamic.path}); name it by id`,
      );
  }
  return syncRuleReferenceEdges(
    source,
    contentRuleReferences(judged, ...contents),
    mode === 'rebuild' ? 'rebuild' : { scopes: contentReferenceScopes(judged, ...contents) },
  );
};

// The contents a source's rules live in — the one answer save and revive share, so a regenerated
// source holds exactly the edges its last save wrote.
export const templateRuleContents = (
  template: Pick<EmailTemplate, 'subject' | 'mjml'>,
): string[] => [template.subject ?? '', stripComponentBodies(template.mjml)];

export const componentRuleContents = (component: Pick<EmailComponent, 'mjml'>): string[] => [
  component.mjml,
];

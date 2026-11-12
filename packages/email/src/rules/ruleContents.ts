/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { EmailComponent, EmailTemplate } from '@template/db/generated/client/client';
import { stripComponentBodies } from '@template/email/render/stripComponentBodies';

export type RuleContents<Row> = Record<string, (row: Row) => string[]>;

export const templateRuleContents: RuleContents<Pick<EmailTemplate, 'subject' | 'mjml'>> = {
  subject: (template) => [template.subject ?? ''],
  mjml: (template) => [stripComponentBodies(template.mjml)],
};

export const componentRuleContents: RuleContents<Pick<EmailComponent, 'mjml'>> = {
  mjml: (component) => [component.mjml],
};

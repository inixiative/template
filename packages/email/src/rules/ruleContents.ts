/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { EmailComponent, EmailTemplate } from '@template/db/generated/client/client';
import { stripComponentBodies } from '@template/email/render/stripComponentBodies';

export const templateRuleContents = (
  template: Pick<EmailTemplate, 'subject' | 'mjml'>,
): string[] => [template.subject ?? '', stripComponentBodies(template.mjml)];

export const componentRuleContents = (component: Pick<EmailComponent, 'mjml'>): string[] => [
  component.mjml,
];

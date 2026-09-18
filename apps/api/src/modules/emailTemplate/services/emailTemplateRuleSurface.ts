/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */
import type { Lens, SourceValues } from '@inixiative/json-rules';
import type { OwnerScope } from '@template/email/render';
import { type EmailRuleDecoration, emailRuleDecoration, emailSurface } from '@template/email/rules';
import { emailLensFor } from '#/lib/email/emailLensFor';
import { emailSourceValues } from '#/lib/email/emailSourceValues';

export type EmailTemplateRuleSurface = { source: Lens; sourceValues: SourceValues[]; decoration: EmailRuleDecoration };

export const emailTemplateRuleSurface = async (
  slug: string,
  owner: OwnerScope,
  lensOverride?: unknown,
): Promise<EmailTemplateRuleSurface> => {
  const lens = await emailLensFor(slug, owner, lensOverride);
  return {
    source: emailSurface(lens),
    sourceValues: await emailSourceValues(lens),
    decoration: emailRuleDecoration(lens),
  };
};

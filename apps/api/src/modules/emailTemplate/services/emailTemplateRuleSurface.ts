/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */
import type { SourceValues } from '@inixiative/json-rules';
import type { OwnerScope } from '@template/email/render';
import {
  type EmailRuleDecoration,
  type EmailSurface,
  emailRuleDecoration,
  emailSurface,
  emailSurfaceSourceValues,
} from '@template/email/rules';
import { fetchStoredLensAndBuildEmailLens } from '#/lib/email/emailLensFor';
import { fetchSourceValuesOfEmailLens } from '#/lib/email/fetchSourceValuesOfEmailLens';

export type EmailTemplateRuleSurface = {
  source: EmailSurface;
  sourceValues: SourceValues[];
  decoration: EmailRuleDecoration;
};

export const emailTemplateRuleSurface = async (
  slug: string,
  owner: OwnerScope,
): Promise<EmailTemplateRuleSurface> => {
  const lens = await fetchStoredLensAndBuildEmailLens(slug, owner);
  return {
    source: emailSurface(lens),
    sourceValues: emailSurfaceSourceValues(await fetchSourceValuesOfEmailLens(lens)),
    decoration: emailRuleDecoration(lens),
  };
};

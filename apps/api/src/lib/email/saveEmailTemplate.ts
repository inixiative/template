/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import {
  type LensForSlug,
  type SaveTemplateInput,
  type SaveTemplateResult,
  saveEmailTemplate as saveWithoutLens,
} from '@template/email/render';
import { emailTemplateRuleLens } from '#/modules/emailTemplate/services/emailTemplateRuleSurface';

export const emailLensFor: LensForSlug = (slug, locale) => emailTemplateRuleLens(slug, locale);

export const saveEmailTemplate = async (input: SaveTemplateInput): Promise<SaveTemplateResult> => {
  const locale = input.locale ?? 'en';
  const lens =
    input.ownerModel === 'default' && input.lens !== undefined
      ? await emailTemplateRuleLens(input.slug, locale, input.lens)
      : await emailLensFor(input.slug, locale);
  return saveWithoutLens(input, { lens, lensFor: emailLensFor });
};

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
import { emailTemplateRuleSurface } from '#/modules/emailTemplate/services/emailTemplateRuleSurface';

export const emailLensFor: LensForSlug = async (slug, locale) => (await emailTemplateRuleSurface(slug, locale)).source;

export const saveEmailTemplate = async (input: SaveTemplateInput): Promise<SaveTemplateResult> =>
  saveWithoutLens(input, { lens: await emailLensFor(input.slug, input.locale ?? 'en'), lensFor: emailLensFor });

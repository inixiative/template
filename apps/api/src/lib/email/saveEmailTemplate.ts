/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import {
  ownerScopeOf,
  type SaveTemplateInput,
  type SaveTemplateResult,
  saveEmailTemplate as saveWithoutLens,
} from '@template/email/render';
import { emailLensFor } from '#/lib/email/emailLensFor';

export const saveEmailTemplate = async (input: SaveTemplateInput): Promise<SaveTemplateResult> => {
  const owner = ownerScopeOf(input);
  const lens =
    input.ownerModel === 'default' && input.lens !== undefined
      ? await emailLensFor(input.slug, owner, input.lens)
      : await emailLensFor(input.slug, owner);
  return saveWithoutLens(input, { lens, lensFor: emailLensFor });
};

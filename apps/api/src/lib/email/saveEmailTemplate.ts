/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import {
  lookupLens,
  ownerScopeOf,
  type SaveTemplateInput,
  type SaveTemplateResult,
  saveEmailTemplate as saveWithoutLens,
} from '@template/email/render';
import { emailLensAt, emailLensFor } from '#/lib/email/emailLensFor';

export const saveEmailTemplate = async (input: SaveTemplateInput): Promise<SaveTemplateResult> => {
  const owner = ownerScopeOf(input);
  const lens = emailLensFor(input.slug, owner, input.lens ?? (await lookupLens(input.slug, owner)));
  return saveWithoutLens(input, { lens, lensFor: emailLensAt });
};

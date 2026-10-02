/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db } from '@template/db';
import type { EmailOwnerModel } from '@template/db/generated/client/client';
import { ReservedSlugError } from '@template/email/errors/ReservedSlugError';

export const assertTemplateSlugAvailable = async (
  slug: string,
  ownerModel: EmailOwnerModel,
): Promise<void> => {
  await db.findForUpdate('EmailTemplate', { slug }, { upserting: true });
  const holder = await db.emailTemplate.findFirst({
    where: {
      slug,
      deletedAt: null,
      ownerModel: ownerModel === 'admin' ? { not: 'admin' } : 'admin',
    },
    select: { ownerModel: true },
  });
  if (holder) throw new ReservedSlugError(slug, ownerModel, holder.ownerModel);
};

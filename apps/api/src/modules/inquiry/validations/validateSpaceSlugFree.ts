/**
 * @atlas
 * @kind validator
 * @partOf feature:inquiry, feature:tenancy
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { makeError } from '#/lib/errors';

export const validateSpaceSlugFree = async (organizationId: string, slug: string) => {
  const taken = await db.withDeleted(() =>
    db.space.findFirst({ where: { organizationId, slug }, select: { id: true } }),
  );
  if (taken)
    throw makeError({
      status: 409,
      message: `The target organization already has a space with the slug "${slug}"`,
    });
};

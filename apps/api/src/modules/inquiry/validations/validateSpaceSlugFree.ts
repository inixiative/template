/**
 * @atlas
 * @kind validator
 * @partOf feature:inquiry, feature:tenancy
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { InquiryType } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { openInquiryWhere } from '#/modules/inquiry/validations/validateInquiryStatus';

type SpaceSlugClaim = {
  organizationId: string;
  slug: string;
  spaceId?: string;
  inquiryId?: string;
};

export const validateSpaceSlugFree = async ({
  organizationId,
  slug,
  spaceId,
  inquiryId,
}: SpaceSlugClaim): Promise<void> => {
  const [existingSpace, pendingClaim] = await Promise.all([
    db.withDeleted(() =>
      db.space.findFirst({
        where: { organizationId, slug, ...(spaceId && { id: { not: spaceId } }) },
        select: { id: true },
      }),
    ),
    db.inquiry.findFirst({
      where: {
        type: { in: [InquiryType.createSpace, InquiryType.updateSpace] },
        sourceOrganizationId: organizationId,
        ...openInquiryWhere(),
        content: { path: ['slug'], equals: slug },
        ...(inquiryId && { id: { not: inquiryId } }),
      },
      select: { id: true },
    }),
  ]);

  if (existingSpace)
    throw makeError({ status: 409, message: 'A space with this slug already exists' });
  if (pendingClaim)
    throw makeError({
      status: 409,
      message: 'An open request for a space with this slug already exists',
    });
};

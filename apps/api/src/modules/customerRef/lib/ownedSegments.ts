/**
 * @atlas
 * @kind query
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import { toSourceQueries } from '@inixiative/json-rules';
import { db, sourceQueryWhere } from '@template/db';
import type { Prisma, Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { resolvedCustomerRefLens } from '#/modules/customerRef/lib/resolvedCustomerRefLens';

/** The segments the lens lets this owner name — its own live ones — read through the Segment source it declares. */
export const ownedSegments = async (
  ownerModel: ProviderModel,
  ownerId: string,
): Promise<Segment[]> => {
  const lens = resolvedCustomerRefLens(ownerModel, ownerId);
  const source = toSourceQueries(lens).find(
    (query) => query.model === 'Segment' && query.field === 'id',
  )!;
  return db.segment.findMany({
    where: (await sourceQueryWhere(source, { lens })) as Prisma.SegmentWhereInput,
  });
};

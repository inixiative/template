/**
 * @atlas
 * @kind service
 * @partOf feature:featureFlag
 * @uses infrastructure:prisma, feature:segment
 */
import { db } from '@template/db';
import type { CustomerModel } from '@template/db/generated/client/enums';
import { shuffle } from 'lodash-es';
import { type Provider, providerWhere } from '#/modules/segment/lib/segmentOwner';

type Sample = { percent: number; from?: string };

/** Draws `percent` of the owner's customers of the subject kind (or of a segment's members) that are not already enrolled. */
export const sampleCustomerRefIds = async (
  owner: Provider,
  subjectModel: CustomerModel,
  sample: Sample,
  enrolled: string[],
): Promise<string[]> => {
  const population = await db.customerRef.findMany({
    where: {
      ...providerWhere(owner.ownerModel, owner.ownerId),
      customerModel: subjectModel,
      deletedAt: null,
      ...(sample.from ? { segmentMembers: { some: { segmentId: sample.from } } } : {}),
    },
  });
  const target = Math.round((population.length * sample.percent) / 100);
  const kept = enrolled.filter((id) => population.some((ref) => ref.id === id));
  const remainder = shuffle(population.map((ref) => ref.id).filter((id) => !kept.includes(id)));
  return [...kept, ...remainder.slice(0, Math.max(0, target - kept.length))];
};

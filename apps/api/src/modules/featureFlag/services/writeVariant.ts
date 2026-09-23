/**
 * @atlas
 * @kind service
 * @partOf feature:featureFlag
 * @uses infrastructure:prisma, feature:segment, primitive:appEvents
 */
import { db, type Prisma, polymorphicKeyColumn } from '@template/db';
import type { FeatureFlag, FeatureFlagVariant, Segment } from '@template/db/generated/client/client';
import type { SegmentType } from '@template/db/generated/client/enums';
import { emitAppEvent } from '#/appEvents/emit';
import { makeError } from '#/lib/errors';
import { featureFlagOwnerIdOf } from '#/modules/featureFlag/lib/featureFlagOwner';

type InternalSegment = { type: SegmentType; conditions: unknown };

export type VariantAudience = { segmentId?: string | null; internalSegment?: InternalSegment };

export type VariantWrite = VariantAudience & Partial<Omit<FeatureFlagVariant, 'segmentId'>>;

const ownerColumns = (
  flag: FeatureFlag,
): Pick<Prisma.SegmentUncheckedCreateInput, 'ownerModel'> & Record<string, string> => {
  const fk = polymorphicKeyColumn('Segment', 'ownerModel', flag.ownerModel);
  return { ownerModel: flag.ownerModel, ...(fk ? { [fk]: featureFlagOwnerIdOf(flag) } : {}) };
};

const internalName = (flag: FeatureFlag, label: string): string => `${flag.slug}/${label}`;

const createInternal = (flag: FeatureFlag, label: string, data: InternalSegment): Promise<Segment> =>
  db.segment.create({
    data: {
      ...ownerColumns(flag),
      name: internalName(flag, label),
      type: data.type,
      conditions: data.conditions as Prisma.InputJsonValue,
      featureFlagInternal: true,
    },
  });

const writeInternal = async (
  flag: FeatureFlag,
  variant: FeatureFlagVariant,
  current: Segment | null,
  data: InternalSegment,
): Promise<Segment> => {
  if (current?.featureFlagInternal) {
    const updated = await db.segment.update({
      where: { id: current.id },
      data: {
        type: data.type,
        conditions: data.conditions as Prisma.InputJsonValue,
        name: internalName(flag, variant.label),
      },
    });
    await emitAppEvent('segment.updated', { segment: updated, previous: current });
    await emitAppEvent('featureFlag.changed', {
      ownerModel: flag.ownerModel,
      ownerId: featureFlagOwnerIdOf(flag),
      slug: flag.slug,
    });
    return updated;
  }
  const created = await createInternal(flag, variant.label, data);
  await emitAppEvent('segment.created', { segment: created });
  return created;
};

const audienceFor = async (
  flag: FeatureFlag,
  variant: FeatureFlagVariant,
  audience: VariantAudience,
): Promise<string | null | undefined> => {
  const current = variant.segmentId ? await db.segment.findUnique({ where: { id: variant.segmentId } }) : null;
  if (audience.internalSegment) return (await writeInternal(flag, variant, current, audience.internalSegment)).id;
  return audience.segmentId;
};

const ownInternal = async (variant: FeatureFlagVariant): Promise<Segment | null> =>
  variant.segmentId ? db.segment.findFirst({ where: { id: variant.segmentId, featureFlagInternal: true } }) : null;

const memberIdsOf = async (segment: Segment): Promise<string[]> =>
  (await db.segmentMember.findMany({ where: { segmentId: segment.id } })).map((member) => member.customerRefId);

const detachInternal = async (variant: FeatureFlagVariant, nextSegmentId: string | null | undefined): Promise<void> => {
  if (!variant.segmentId || nextSegmentId === undefined || nextSegmentId === variant.segmentId) return;
  const current = await ownInternal(variant);
  if (!current) return;
  const customerRefIds = await memberIdsOf(current);
  const deleted = await db.segment.update({ where: { id: current.id }, data: { deletedAt: new Date() } });
  await emitAppEvent('segment.deleted', { segment: deleted, customerRefIds });
};

const assertOneAudience = (audience: VariantAudience): void => {
  if (audience.segmentId != null && audience.internalSegment) {
    throw makeError({ status: 422, message: 'a variant takes one audience: segmentId or internalSegment' });
  }
};

export const createVariant = async (flag: FeatureFlag, write: VariantWrite): Promise<FeatureFlagVariant> => {
  const { segmentId, internalSegment, ...columns } = write;
  assertOneAudience({ segmentId, internalSegment });
  if (!columns.isDefault && !segmentId && !internalSegment) {
    throw makeError({ status: 422, message: 'a rule variant names the segment it serves' });
  }
  return db.txn(async () => {
    const segment = internalSegment ? await createInternal(flag, columns.label ?? '', internalSegment) : null;
    const variant = await db.featureFlagVariant.create({
      data: {
        ...columns,
        featureFlagId: flag.id,
        segmentId: segment?.id ?? segmentId ?? null,
      } as Prisma.FeatureFlagVariantUncheckedCreateInput,
    });
    if (segment) await emitAppEvent('segment.created', { segment });
    return variant;
  });
};

export const updateVariant = async (
  flag: FeatureFlag,
  variant: FeatureFlagVariant,
  write: VariantWrite,
): Promise<FeatureFlagVariant> => {
  const { segmentId, internalSegment, ...columns } = write;
  assertOneAudience({ segmentId, internalSegment });
  const next = { ...variant, ...columns } as FeatureFlagVariant;
  return db.txn(async () => {
    const nextSegmentId = await audienceFor(flag, next, { segmentId, internalSegment });
    await detachInternal(variant, nextSegmentId);
    if (columns.label !== undefined && columns.label !== variant.label) {
      const internal = await ownInternal({ ...variant, segmentId: nextSegmentId ?? variant.segmentId });
      if (internal) {
        await db.segment.update({ where: { id: internal.id }, data: { name: internalName(flag, next.label) } });
      }
    }
    return db.featureFlagVariant.update({
      where: { id: variant.id },
      data: {
        ...columns,
        ...(nextSegmentId !== undefined ? { segmentId: nextSegmentId } : {}),
      } as Prisma.FeatureFlagVariantUncheckedUpdateInput,
    });
  });
};

/** The variant's tombstone cascades to its internal segment; only the membership event needs publishing. */
export const deleteVariant = async (variant: FeatureFlagVariant): Promise<void> => {
  const internal = await ownInternal(variant);
  const customerRefIds = internal ? await memberIdsOf(internal) : [];
  const deletedAt = new Date();
  await db.featureFlagVariant.update({ where: { id: variant.id }, data: { deletedAt } });
  if (internal) await emitAppEvent('segment.deleted', { segment: { ...internal, deletedAt }, customerRefIds });
};

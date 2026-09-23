/**
 * @atlas
 * @kind service
 * @partOf feature:featureFlag
 * @uses infrastructure:prisma, feature:segment, primitive:appEvents
 */
import { Operator } from '@inixiative/json-rules';
import { db, type Prisma, polymorphicKeyColumn } from '@template/db';
import type { FeatureFlag, FeatureFlagVariant, Segment } from '@template/db/generated/client/client';
import { SegmentType } from '@template/db/generated/client/enums';
import { emitAppEvent } from '#/appEvents/emit';
import { makeError } from '#/lib/errors';
import { featureFlagOwnerIdOf } from '#/modules/featureFlag/lib/featureFlagOwner';
import { sampleCustomerRefIds } from '#/modules/featureFlag/services/sampleCustomerRefIds';
import { assertSegmentUsableBy } from '#/modules/featureFlag/validations/assertSegmentUsableBy';
import type { Provider } from '#/modules/segment/lib/segmentOwner';

type InternalSegment = { type: SegmentType; conditions: unknown };
type Sample = { percent: number; from?: string };

export type VariantAudience = { segmentId?: string | null; internalSegment?: InternalSegment; sample?: Sample };

export type VariantWrite = VariantAudience & Partial<Omit<FeatureFlagVariant, 'segmentId'>>;

const ownerOf = (flag: FeatureFlag): Provider => ({ ownerModel: flag.ownerModel, ownerId: featureFlagOwnerIdOf(flag) });

const ownerColumns = (
  flag: FeatureFlag,
): Pick<Prisma.SegmentUncheckedCreateInput, 'ownerModel'> & Record<string, string> => {
  const fk = polymorphicKeyColumn('Segment', 'ownerModel', flag.ownerModel);
  return { ownerModel: flag.ownerModel, ...(fk ? { [fk]: featureFlagOwnerIdOf(flag) } : {}) };
};

const idsRule = (ids: string[]) => ({ field: 'id', operator: Operator.in, value: ids });

const enrolledIds = (segment: Segment | null): string[] => {
  const rule = segment?.conditions as { field?: string; operator?: string; value?: unknown } | null;
  return rule?.field === 'id' && rule.operator === Operator.in && Array.isArray(rule.value)
    ? (rule.value as string[])
    : [];
};

const internalName = (flag: FeatureFlag, variant: Pick<FeatureFlagVariant, 'id' | 'label'>): string =>
  `${flag.slug}/${variant.label} ${variant.id}`;

const writeInternal = async (
  flag: FeatureFlag,
  variant: FeatureFlagVariant,
  current: Segment | null,
  data: { type: SegmentType; conditions: unknown },
): Promise<Segment> => {
  if (current?.featureFlagVariantId === variant.id) {
    const updated = await db.segment.update({
      where: { id: current.id },
      data: {
        type: data.type,
        conditions: data.conditions as Prisma.InputJsonValue,
        name: internalName(flag, variant),
      },
    });
    await emitAppEvent('segment.updated', { segment: updated, previous: current });
    return updated;
  }
  const created = await db.segment.create({
    data: {
      ...ownerColumns(flag),
      name: internalName(flag, variant),
      type: data.type,
      conditions: data.conditions as Prisma.InputJsonValue,
      featureFlagVariantId: variant.id,
    },
  });
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
  if (audience.sample) {
    if (audience.sample.from) await assertSegmentUsableBy(audience.sample.from, ownerOf(flag));
    const own = current?.featureFlagVariantId === variant.id ? current : null;
    const ids = await sampleCustomerRefIds(ownerOf(flag), flag.subjectModel, audience.sample, enrolledIds(own));
    return (await writeInternal(flag, variant, current, { type: SegmentType.static, conditions: idsRule(ids) })).id;
  }
  return audience.segmentId;
};

const ownInternal = async (variant: FeatureFlagVariant): Promise<Segment | null> =>
  variant.segmentId
    ? db.segment.findFirst({ where: { id: variant.segmentId, featureFlagVariantId: variant.id } })
    : null;

const memberIdsOf = async (segment: Segment): Promise<string[]> =>
  (await db.segmentMember.findMany({ where: { segmentId: segment.id } })).map((member) => member.customerRefId);

const detachInternal = async (variant: FeatureFlagVariant, nextSegmentId: string | null | undefined): Promise<void> => {
  if (!variant.segmentId || nextSegmentId === undefined || nextSegmentId === variant.segmentId) return;
  const current = await ownInternal(variant);
  if (!current) return;
  const customerRefIds = await memberIdsOf(current);
  const deleted = await db.segment.update({
    where: { id: current.id },
    data: { deletedAt: new Date(), featureFlagVariantId: null },
  });
  await emitAppEvent('segment.deleted', { segment: deleted, customerRefIds });
};

const assertOneAudience = (audience: VariantAudience): void => {
  const given = [audience.segmentId, audience.internalSegment, audience.sample].filter((each) => each != null);
  if (given.length > 1) {
    throw makeError({ status: 422, message: 'a variant takes one audience: segmentId, internalSegment or sample' });
  }
};

const resolveInternal = async (flag: FeatureFlag, audience: VariantAudience): Promise<InternalSegment | null> => {
  if (audience.internalSegment) return audience.internalSegment;
  if (!audience.sample) return null;
  if (audience.sample.from) await assertSegmentUsableBy(audience.sample.from, ownerOf(flag));
  const ids = await sampleCustomerRefIds(ownerOf(flag), flag.subjectModel, audience.sample, []);
  return { type: SegmentType.static, conditions: idsRule(ids) };
};

export const createVariant = async (flag: FeatureFlag, write: VariantWrite): Promise<FeatureFlagVariant> => {
  const { segmentId, internalSegment, sample, ...columns } = write;
  assertOneAudience({ segmentId, internalSegment, sample });
  const internal = await resolveInternal(flag, { internalSegment, sample });
  if (!columns.isDefault && !segmentId && !internal) {
    throw makeError({ status: 422, message: 'a rule variant names the segment it serves' });
  }
  const id = Bun.randomUUIDv7();
  return db.txn(async () => {
    const segment = internal
      ? await db.segment.create({
          data: {
            ...ownerColumns(flag),
            name: internalName(flag, { id, label: columns.label ?? '' }),
            type: internal.type,
            conditions: internal.conditions as Prisma.InputJsonValue,
          },
        })
      : null;
    const variant = await db.featureFlagVariant.create({
      data: {
        ...columns,
        id,
        featureFlagId: flag.id,
        segmentId: segment?.id ?? segmentId ?? null,
      } as Prisma.FeatureFlagVariantUncheckedCreateInput,
    });
    if (segment) {
      const owned = await db.segment.update({ where: { id: segment.id }, data: { featureFlagVariantId: variant.id } });
      await emitAppEvent('segment.created', { segment: owned });
    }
    return variant;
  });
};

export const updateVariant = async (
  flag: FeatureFlag,
  variant: FeatureFlagVariant,
  write: VariantWrite,
): Promise<FeatureFlagVariant> => {
  const { segmentId, internalSegment, sample, ...columns } = write;
  assertOneAudience({ segmentId, internalSegment, sample });
  const next = { ...variant, ...columns } as FeatureFlagVariant;
  return db.txn(async () => {
    const nextSegmentId = await audienceFor(flag, next, { segmentId, internalSegment, sample });
    await detachInternal(variant, nextSegmentId);
    if (nextSegmentId === undefined && columns.label !== undefined && columns.label !== variant.label) {
      const internal = await ownInternal(variant);
      if (internal) await db.segment.update({ where: { id: internal.id }, data: { name: internalName(flag, next) } });
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

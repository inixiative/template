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

type InlineSegment = { type: SegmentType; conditions: unknown };
type Sample = { percent: number; from?: string };

export type VariantAudience = { segmentId?: string | null; inlineSegment?: InlineSegment; sample?: Sample };

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

const inlineName = (flag: FeatureFlag, variant: FeatureFlagVariant): string => `${flag.slug}/${variant.label}`;

const writeInline = async (
  flag: FeatureFlag,
  variant: FeatureFlagVariant,
  current: Segment | null,
  data: { type: SegmentType; conditions: unknown },
): Promise<Segment> => {
  if (current?.featureFlagVariantId === variant.id) {
    const updated = await db.segment.update({
      where: { id: current.id },
      data: { type: data.type, conditions: data.conditions as Prisma.InputJsonValue, name: inlineName(flag, variant) },
    });
    await emitAppEvent('segment.updated', { segment: updated, previous: current });
    return updated;
  }
  const created = await db.segment.create({
    data: {
      ...ownerColumns(flag),
      name: inlineName(flag, variant),
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
  if (audience.inlineSegment) return (await writeInline(flag, variant, current, audience.inlineSegment)).id;
  if (audience.sample) {
    if (audience.sample.from) await assertSegmentUsableBy(audience.sample.from, ownerOf(flag));
    const ids = await sampleCustomerRefIds(ownerOf(flag), flag.subjectModel, audience.sample, enrolledIds(current));
    return (await writeInline(flag, variant, current, { type: SegmentType.static, conditions: idsRule(ids) })).id;
  }
  return audience.segmentId;
};

const detachInline = async (variant: FeatureFlagVariant, nextSegmentId: string | null | undefined): Promise<void> => {
  if (!variant.segmentId || nextSegmentId === undefined || nextSegmentId === variant.segmentId) return;
  const current = await db.segment.findUnique({ where: { id: variant.segmentId } });
  if (current?.featureFlagVariantId !== variant.id) return;
  const members = await db.segmentMember.findMany({ where: { segmentId: current.id } });
  const deleted = await db.segment.update({ where: { id: current.id }, data: { deletedAt: new Date() } });
  await emitAppEvent('segment.deleted', { segment: deleted, customerRefIds: members.map((m) => m.customerRefId) });
};

const assertOneAudience = (audience: VariantAudience): void => {
  const given = [audience.segmentId, audience.inlineSegment, audience.sample].filter((each) => each != null);
  if (given.length > 1) {
    throw makeError({ status: 422, message: 'a variant takes one audience: segmentId, inlineSegment or sample' });
  }
};

const resolveInline = async (flag: FeatureFlag, audience: VariantAudience): Promise<InlineSegment | null> => {
  if (audience.inlineSegment) return audience.inlineSegment;
  if (!audience.sample) return null;
  if (audience.sample.from) await assertSegmentUsableBy(audience.sample.from, ownerOf(flag));
  const ids = await sampleCustomerRefIds(ownerOf(flag), flag.subjectModel, audience.sample, []);
  return { type: SegmentType.static, conditions: idsRule(ids) };
};

export const createVariant = async (flag: FeatureFlag, write: VariantWrite): Promise<FeatureFlagVariant> => {
  const { segmentId, inlineSegment, sample, ...columns } = write;
  assertOneAudience({ segmentId, inlineSegment, sample });
  const inline = await resolveInline(flag, { inlineSegment, sample });
  if (!columns.isDefault && !segmentId && !inline) {
    throw makeError({ status: 422, message: 'a rule variant names the segment it serves' });
  }
  return db.txn(async () => {
    const segment = inline
      ? await db.segment.create({
          data: {
            ...ownerColumns(flag),
            name: `${flag.slug}/${columns.label}`,
            type: inline.type,
            conditions: inline.conditions as Prisma.InputJsonValue,
          },
        })
      : null;
    const variant = await db.featureFlagVariant.create({
      data: {
        ...columns,
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
  const { segmentId, inlineSegment, sample, ...columns } = write;
  assertOneAudience({ segmentId, inlineSegment, sample });
  return db.txn(async () => {
    const nextSegmentId = await audienceFor(flag, variant, { segmentId, inlineSegment, sample });
    await detachInline(variant, nextSegmentId);
    return db.featureFlagVariant.update({
      where: { id: variant.id },
      data: {
        ...columns,
        ...(nextSegmentId !== undefined ? { segmentId: nextSegmentId } : {}),
      } as Prisma.FeatureFlagVariantUncheckedUpdateInput,
    });
  });
};

export const deleteVariant = async (variant: FeatureFlagVariant): Promise<void> => {
  await db.txn(async () => {
    await db.featureFlagVariant.update({ where: { id: variant.id }, data: { deletedAt: new Date() } });
    await detachInline(variant, null);
  });
};

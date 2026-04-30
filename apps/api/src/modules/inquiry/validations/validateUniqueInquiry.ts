import { type Db, getPolymorphismConfig, type PolymorphicValue, type Prisma } from '@template/db';
import type { InquiryType } from '@template/db/generated/client/enums';
import { makeError } from '#/lib/errors';
import { inquiryTerminalStatuses } from '#/modules/inquiry/validations/validateInquiryStatus';

// Inquiry shape sufficient for uniqueness lookup. We accept any subset of
// Inquiry fields — the FKs we actually filter on are derived from the
// falsePolymorphism registry by sourceModel / targetModel, so callers don't
// have to know which FK belongs to which discriminator value.
type InquiryShape = Omit<Prisma.InquiryWhereInput, 'id'> & {
  id?: string;
  type: InquiryType;
};

type UniqueMode = 'targeted' | 'untargeted';

export const validateUniqueInquiry = async (
  db: Db,
  inquiry: InquiryShape,
  mode: UniqueMode,
): Promise<void> => {
  const config = getPolymorphismConfig('Inquiry');
  if (!config) throw new Error('Inquiry polymorphism config missing from registry');

  const fkFieldsFor = (axisField: 'sourceModel' | 'targetModel'): string[] => {
    const axis = config.axes.find((a) => a.field === axisField);
    if (!axis) return [];
    const value = (inquiry as Record<string, unknown>)[axisField] as PolymorphicValue | undefined;
    return value ? (axis.fkMap[value] ?? []) : [];
  };

  const pickValues = (fields: string[]): Record<string, unknown> =>
    Object.fromEntries(fields.map((f) => [f, (inquiry as Record<string, unknown>)[f]]));

  const where: Prisma.InquiryWhereInput = {
    type: inquiry.type,
    status: { notIn: inquiryTerminalStatuses },
    sourceModel: inquiry.sourceModel,
    ...pickValues(fkFieldsFor('sourceModel')),
  };

  if (mode === 'targeted') {
    where.targetModel = inquiry.targetModel;
    Object.assign(where, pickValues(fkFieldsFor('targetModel')));
  }

  // Exclude the current row if we're re-validating an already-persisted
  // inquiry (e.g. update path) — otherwise findFirst happily matches itself.
  if (inquiry.id) where.id = { not: inquiry.id };

  const existing = await db.inquiry.findFirst({ where });

  if (existing) {
    throw makeError({ status: 409, message: 'An open inquiry of this type already exists between these parties' });
  }
};

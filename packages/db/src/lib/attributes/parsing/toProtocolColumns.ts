/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';
import type { AttributeTypedColumns } from '@template/shared/attributes';

// Only Prisma.DbNull represents SQL NULL; Prisma.JsonNull is a populated JSONB null value.
export const unwrapPrismaDbNull = (value: unknown): unknown =>
  value === Prisma.DbNull ? null : value;

export const toProtocolColumns = (
  row: Record<string, unknown>,
): Partial<AttributeTypedColumns> => ({
  valueBoolean: unwrapPrismaDbNull(row.valueBoolean) as boolean | null,
  valueText: unwrapPrismaDbNull(row.valueText) as string | null,
  valueNumber: unwrapPrismaDbNull(row.valueNumber) as number | null,
  valueDate: unwrapPrismaDbNull(row.valueDate) as Date | string | null,
  valueJson: unwrapPrismaDbNull(row.valueJson),
});

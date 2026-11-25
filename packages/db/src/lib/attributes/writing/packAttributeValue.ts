/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { Prisma } from '@template/db/generated/client/client';
import type { PrismaAttributeColumnPayload } from '@template/db/lib/attributes/types';
import { type AttributeValueType, encodeAttributeValue } from '@template/shared/attributes';

/** Packs a raw value into the 5 Prisma typed value columns for `valueType`, clearing sibling columns. */
export const packAttributeValue = (
  valueType: AttributeValueType,
  value: unknown,
): PrismaAttributeColumnPayload => {
  const encoded = encodeAttributeValue(valueType, value);
  return {
    valueBoolean: encoded.valueBoolean,
    valueText: encoded.valueText,
    valueNumber: encoded.valueNumber,
    valueDate: encoded.valueDate,
    // Prisma 7 requires Prisma.DbNull to store SQL NULL in a nullable Json? column.
    valueJson:
      encoded.valueJson === null ? Prisma.DbNull : (encoded.valueJson as Prisma.InputJsonValue),
  };
};

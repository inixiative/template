/**
 * @atlas
 * @kind type
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { Prisma } from '@template/db/generated/client/client';
import type { AccessorName, ModelName } from '@template/db/utils/modelNames';
import type { AttributeFieldDefinition, AttributeValueType } from '@template/shared/attributes';

export type AttributeModelConfig<A extends AccessorName = AccessorName> = {
  readonly model: A;
  /** Field identifying the attribute definition (e.g. `key` for Setting, `integrationMapId` for custom fields). */
  readonly locatorField?: string;
  /** Optional per-row discriminator column if a schemaless model stores valueType directly on the row. */
  readonly valueTypeField?: string;
  /** Optional polymorphic attachment model discriminator (e.g. `resourceModel` for Setting). */
  readonly resourceModelField?: string;
  /** Optional boolean column disabling an override row without deleting its payload. */
  readonly disabledField?: string;
  /** Optional code-first definition lookup keyed by `locatorField` value. */
  readonly resolveDefinition?: (locator: string) => AttributeFieldDefinition | undefined;
  /** Optional listing of definitions applicable to a given `resourceModel`. */
  readonly definitionsForResourceModel?: (
    resourceModel: string,
  ) => readonly AttributeFieldDefinition[];
};

export type AttributeRange<T extends number | Date | string = number | Date | string> = {
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
};

export type AttributeSortDirection = 'asc' | 'desc';

export type AttributeOperatorOptions = {
  valueType?: AttributeValueType;
  definition?: AttributeFieldDefinition;
};

export type PrismaAttributeColumnPayload = {
  valueBoolean: boolean | null;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueJson: Prisma.InputJsonValue | typeof Prisma.DbNull;
};

export type AttributeWriteInspectionOk = {
  ok: true;
  value: unknown;
  definition?: AttributeFieldDefinition;
  normalizedValueJson?: string[];
  normalizedValueDate?: Date;
};

export type AttributeWriteInspection = AttributeWriteInspectionOk | { ok: false; errors: string[] };

export type AttributeModelInput = AccessorName | ModelName;

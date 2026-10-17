/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { polymorphicAxis } from '@template/db/registries/falsePolymorphism';
import type {
  PolymorphicAxisField,
  PolymorphicAxisValue,
  PolymorphicFkColumn,
  PolymorphicModel,
  PolymorphicSchema,
  PolymorphicSchemaOptions,
} from '@template/db/registries/polymorphicSchemaTypes';
import { uuidV7Schema } from '@template/shared/utils';
import { z } from 'zod';

/** Request-boundary twin of the write rule in `hooks/falsePolymorphism/toRules`: one strict arm per value. */
export const polymorphicSchema = <
  Model extends PolymorphicModel,
  Field extends PolymorphicAxisField<Model>,
  Value extends PolymorphicAxisValue<Model, Field> = PolymorphicAxisValue<Model, Field>,
  Omitted extends PolymorphicFkColumn<Model, Field> = never,
  Extend extends z.ZodRawShape = Record<never, never>,
>(
  model: Model,
  axisField: Field,
  options: PolymorphicSchemaOptions<Model, Field, Value, Omitted, Extend> = {},
): PolymorphicSchema<Model, Field, Value, Omitted, Extend> => {
  const discriminator: string = axisField;
  const fkMap: Partial<Record<string, readonly string[]>> = polymorphicAxis(model, axisField).fkMap;
  const values: readonly string[] = options.only ?? Object.keys(fkMap);
  for (const value of values) {
    if (!fkMap[value]) throw new Error(`${model}.${axisField} has no value ${value}`);
  }
  const axisColumns = new Set([discriminator, ...Object.values(fkMap).flat()]);
  const collision = Object.keys(options.extend ?? {}).find((key) => axisColumns.has(key));
  if (collision) throw new Error(`${model}.${axisField}: extend cannot redefine ${collision}`);
  const omitted = new Set<string>(options.omit);
  const [first, ...rest] = values.map((value) =>
    z.strictObject({
      [discriminator]: z.literal(value),
      ...Object.fromEntries(
        (fkMap[value] ?? []).filter((fk) => !omitted.has(fk)).map((fk) => [fk, uuidV7Schema]),
      ),
      ...options.extend,
    }),
  );
  if (!first) throw new Error(`${model}.${axisField}: polymorphicSchema needs at least one value`);
  const schema: z.ZodType = z.discriminatedUnion(discriminator, [first, ...rest]);
  return schema as PolymorphicSchema<Model, Field, Value, Omitted, Extend>;
};

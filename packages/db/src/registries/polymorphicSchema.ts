/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  type PolymorphismRegistry,
  polymorphicAxis,
} from '@template/db/registries/falsePolymorphism';
import { uuidV7Schema } from '@template/shared/utils';
import { z } from 'zod';

type Registry = typeof PolymorphismRegistry;
export type PolymorphicModel = keyof Registry;
type AxisOf<M extends PolymorphicModel> = Registry[M]['axes'][number];
export type PolymorphicAxisField<M extends PolymorphicModel> = AxisOf<M>['field'];
type FkMapOf<M extends PolymorphicModel, A> = Extract<AxisOf<M>, { field: A }>['fkMap'];
export type PolymorphicAxisValue<M extends PolymorphicModel, A> = keyof FkMapOf<M, A> & string;
type FkColumnsOf<M extends PolymorphicModel, A, V> = V extends keyof FkMapOf<M, A>
  ? FkMapOf<M, A>[V] extends readonly (infer Column extends string)[]
    ? Column
    : never
  : never;
export type PolymorphicFkColumn<M extends PolymorphicModel, A> = FkColumnsOf<
  M,
  A,
  PolymorphicAxisValue<M, A>
>;

type Flatten<T> = { [K in keyof T]: T[K] } & {};

export type PolymorphicTarget<
  M extends PolymorphicModel,
  A extends string,
  V extends string,
  O extends string,
> =
  V extends PolymorphicAxisValue<M, A>
    ? Flatten<{ [K in A]: V } & { [F in Exclude<FkColumnsOf<M, A, V>, O>]: string }>
    : never;

type WithShape<Target, Extra> = Target extends unknown ? Flatten<Target & Extra> : never;

export type PolymorphicSchema<
  M extends PolymorphicModel,
  A extends string,
  V extends string,
  O extends string,
  E extends z.ZodRawShape,
> = z.ZodType<
  WithShape<
    PolymorphicTarget<M, A, V, O>,
    keyof E extends never ? unknown : z.output<z.ZodObject<E>>
  >,
  WithShape<
    PolymorphicTarget<M, A, V, O>,
    keyof E extends never ? unknown : z.input<z.ZodObject<E>>
  >
>;

/** Request-boundary twin of the write rule in `hooks/falsePolymorphism/toRules`: one strict arm per value. */
export const polymorphicSchema = <
  M extends PolymorphicModel,
  A extends PolymorphicAxisField<M>,
  V extends PolymorphicAxisValue<M, A> = PolymorphicAxisValue<M, A>,
  O extends PolymorphicFkColumn<M, A> = never,
  E extends z.ZodRawShape = Record<never, never>,
>(
  model: M,
  axisField: A,
  options: {
    only?: readonly V[];
    omit?: readonly O[];
    extend?: E & { [K in A | PolymorphicFkColumn<M, A>]?: never };
  } = {},
): PolymorphicSchema<M, A, V, O, E> => {
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
  return schema as PolymorphicSchema<M, A, V, O, E>;
};

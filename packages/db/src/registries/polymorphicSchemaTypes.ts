/**
 * @atlas
 * @kind type
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { PolymorphismRegistry } from '@template/db/registries/falsePolymorphism';
import type { z } from 'zod';

type Registry = typeof PolymorphismRegistry;

export type PolymorphicModel = keyof Registry;

type Axis<Model extends PolymorphicModel> = Registry[Model]['axes'][number];

export type PolymorphicAxisField<Model extends PolymorphicModel> = Axis<Model>['field'];

type FkMap<Model extends PolymorphicModel, Field> = Extract<Axis<Model>, { field: Field }>['fkMap'];

export type PolymorphicAxisValue<Model extends PolymorphicModel, Field> = keyof FkMap<
  Model,
  Field
> &
  string;

type RequiredFks<Model extends PolymorphicModel, Field, Value> = Extract<
  FkMap<Model, Field>[Value & keyof FkMap<Model, Field>],
  readonly string[]
>[number];

export type PolymorphicFkColumn<Model extends PolymorphicModel, Field> = RequiredFks<
  Model,
  Field,
  PolymorphicAxisValue<Model, Field>
>;

type Flatten<T> = { [K in keyof T]: T[K] } & {};

export type PolymorphicTarget<
  Model extends PolymorphicModel,
  Field extends string,
  Value extends string,
  Omitted extends string,
> =
  Value extends PolymorphicAxisValue<Model, Field>
    ? Flatten<
        Record<Field, Value> & Record<Exclude<RequiredFks<Model, Field, Value>, Omitted>, string>
      >
    : never;

type ExtendShape<
  Extend extends z.ZodRawShape,
  Side extends 'input' | 'output',
> = keyof Extend extends never
  ? unknown
  : Side extends 'output'
    ? z.output<z.ZodObject<Extend>>
    : z.input<z.ZodObject<Extend>>;

type WithExtend<Targets, Extra> = Targets extends unknown ? Flatten<Targets & Extra> : never;

export type PolymorphicSchema<
  Model extends PolymorphicModel,
  Field extends string,
  Value extends string,
  Omitted extends string,
  Extend extends z.ZodRawShape,
> = z.ZodType<
  WithExtend<PolymorphicTarget<Model, Field, Value, Omitted>, ExtendShape<Extend, 'output'>>,
  WithExtend<PolymorphicTarget<Model, Field, Value, Omitted>, ExtendShape<Extend, 'input'>>
>;

type Forbidden<Keys extends string> = { [K in Keys]?: never };

export type PolymorphicSchemaOptions<
  Model extends PolymorphicModel,
  Field extends PolymorphicAxisField<Model>,
  Value extends string,
  Omitted extends string,
  Extend extends z.ZodRawShape,
> = {
  only?: readonly Value[];
  omit?: readonly Omitted[];
  extend?: Extend & Forbidden<Field | PolymorphicFkColumn<Model, Field>>;
};

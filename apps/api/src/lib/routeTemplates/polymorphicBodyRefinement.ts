/**
 * @atlas
 * @kind helper
 * @partOf primitive:routeTemplates
 * @uses infrastructure:prisma
 */
import {
  type PolymorphicAxisField,
  type PolymorphicAxisValue,
  type PolymorphicFkColumn,
  type PolymorphicModel,
  polymorphicAxis,
  polymorphicSchema,
} from '@template/db';
import { pick } from 'lodash-es';
import type { z } from 'zod';

type PolymorphicBodyRefinementOptions<
  Model extends PolymorphicModel,
  Field extends PolymorphicAxisField<Model>,
> = {
  only?: readonly PolymorphicAxisValue<Model, Field>[];
  omit?: readonly PolymorphicFkColumn<Model, Field>[];
};

export const polymorphicBodyRefinement = <
  Model extends PolymorphicModel,
  Field extends PolymorphicAxisField<Model>,
>(
  model: Model,
  axisField: Field,
  options: PolymorphicBodyRefinementOptions<Model, Field> = {},
) => {
  const schema: z.ZodType = polymorphicSchema(model, axisField, options);
  const axisColumns = [axisField, ...Object.values(polymorphicAxis(model, axisField).fkMap).flat()];

  return (body: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const result = schema.safeParse(pick(body, axisColumns));
    if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ ...issue });
  };
};

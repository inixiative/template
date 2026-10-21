/**
 * @atlas
 * @kind schema
 * @partOf feature:segment
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { ConditionShape } from '@inixiative/json-rules';
import { infoResponseSchema } from '#/lib/jsonSchema/infoResponseSchema';

const operatorsByKindSchema = z.record(z.string(), z.array(z.string()));

export const segmentInfoResponseSchema = infoResponseSchema(
  z.object({
    root: z.string().describe('The model each condition is evaluated against.'),
    conditionShapes: z
      .record(
        z.nativeEnum(ConditionShape),
        z.object({
          required: z.array(z.string()).describe('Keys a node of this shape must have.'),
          optional: z.array(z.string()).describe('Keys it may have.'),
        }),
      )
      .describe(
        'The node shapes a condition is built from, as `@inixiative/json-rules` defines them. A literal `true` or `false` is a condition too.',
      ),
    operators: z
      .object({
        field: operatorsByKindSchema.describe(
          'Per field kind, the `operator` values a `field` node on it takes.',
        ),
        date: operatorsByKindSchema.describe(
          'Per field kind, the `dateOperator` values a `date` node on it takes.',
        ),
        array: z.array(z.string()).describe('The `arrayOperator` values an `array` node takes.'),
        aggregate: z.array(z.string()).describe('The `operator` values an `aggregate` node takes.'),
      })
      .describe('Operators that compile to a Prisma query.'),
    valueShapes: z
      .object({
        field: z
          .record(z.string(), z.string())
          .describe('Per field operator, the operand it takes.'),
        date: z.record(z.string(), z.string()).describe('Per date operator, the operand it takes.'),
        array: z
          .record(z.string(), z.string())
          .describe('Per array operator, the operand it takes.'),
      })
      .describe('The operand each operator takes: `none` takes no `value`.'),
    fields: z
      .array(
        z.object({
          path: z.string().describe('Dotted path from `root`; the `field` a node names.'),
          model: z.string().describe('Model the field is on.'),
          kind: z.string().describe('Field kind, or `relation`.'),
          type: z.string().describe('Prisma type: scalar, enum or related model name.'),
          isList: z.boolean().describe('A to-many relation or a list column.'),
          values: z.array(z.string()).describe('Allowed values of an enum field.'),
          sourced: z
            .boolean()
            .describe(
              'Takes the id of a row its owner may name: its own live segments, its own or platform tags.',
            ),
        }),
      )
      .describe('Every field a condition may read, from `customerRefLens`.'),
  }),
);

/**
 * @atlas
 * @kind schema
 * @partOf feature:segment
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { infoResponseSchema } from '#/lib/jsonSchema/infoResponseSchema';

export const segmentInfoResponseSchema = infoResponseSchema(
  z
    .object({
      conditions: z
        .literal('rule')
        .describe(
          'A `@inixiative/json-rules` condition, compiled with `toPrisma`. See the rules engine.',
        ),
      root: z.string().describe('The model each condition is evaluated against.'),
      fields: z
        .array(
          z.object({
            path: z
              .string()
              .describe(
                'Dotted path from `root`. Under a to-many relation, name the part after it inside that array node’s `condition`.',
              ),
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
    })
    .describe('What a segment’s `conditions` may read.'),
);

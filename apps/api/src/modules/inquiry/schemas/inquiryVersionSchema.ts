/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { z } from '@hono/zod-openapi';

export const inquiryVersionSchema = z.object({
  expectedUpdatedAt: z.coerce
    .date()
    .describe(
      'The inquiry `updatedAt` you acted on; a mismatch is a 409 (it changed since you read it)',
    ),
});

import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventSelectObjectSchema as WebhookEventSelectObjectSchema } from './WebhookEventSelect.schema';
import { WebhookEventIncludeObjectSchema as WebhookEventIncludeObjectSchema } from './WebhookEventInclude.schema'

const makeSchema = () => z.object({
  select: z.lazy(() => WebhookEventSelectObjectSchema).optional(),
  include: z.lazy(() => WebhookEventIncludeObjectSchema).optional()
}).strict();
export const WebhookEventArgsObjectSchema = makeSchema();
export const WebhookEventArgsObjectZodSchema = makeSchema();

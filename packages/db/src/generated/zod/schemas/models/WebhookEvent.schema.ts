import * as z from 'zod';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema';

export const WebhookEventSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  status: WebhookEventStatusSchema,
  action: WebhookEventActionSchema,
  payload: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  error: z.string().nullish(),
  webhookSubscriptionId: z.string(),
  resourceId: z.string(),
});

export type WebhookEventType = z.infer<typeof WebhookEventSchema>;

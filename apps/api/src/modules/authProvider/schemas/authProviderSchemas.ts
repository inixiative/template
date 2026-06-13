/**
 * @atlas
 * @kind schema
 * @partOf feature:auth
 * @uses none
 */
import { z } from '@hono/zod-openapi';

export const PlatformProviderSchema = z.object({
  type: z.enum(['oauth', 'saml']),
  provider: z.string(),
  name: z.string(),
  enabled: z.boolean(),
});

export type PlatformProvider = z.infer<typeof PlatformProviderSchema>;

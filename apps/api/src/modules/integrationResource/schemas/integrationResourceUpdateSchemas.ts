/**
 * @atlas
 * @kind schema
 * @partOf feature:integrations
 */
import { z } from '@hono/zod-openapi';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';

export const integrationResourceUpdateBodySchema = z.object({
  status: z.enum([IntegrationResourceStatus.tracked, IntegrationResourceStatus.untracked]).openapi({
    description:
      'Untracked: we stop listening; it leaves every list and flow, keeps its grants, and no sync brings it back. Tracked: listen again (`missing` is set by Kingdom, never by a caller).',
  }),
});

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
      'Untracked: we stop listening; it leaves every list and flow, keeps its grants, and no sync brings it back. Tracked: listen again; a resource the provider no longer shows stays `missing`, which only the app sync sets.',
  }),
});

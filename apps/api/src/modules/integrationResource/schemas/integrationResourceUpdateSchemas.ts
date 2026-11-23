/**
 * @atlas
 * @kind schema
 * @partOf feature:integrations
 */
import { z } from '@hono/zod-openapi';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';

export const integrationResourceUpdateBodySchema = z.object({
  status: z.enum(IntegrationResourceStatus).openapi({
    description:
      "Tracked: we listen. Untracked: we stop listening; it leaves every list and flow, keeps its grants, and no sync brings it back. Missing: the provider no longer lists it. A person tracks and untracks; only the resource's own integration moves it to or from missing.",
  }),
});

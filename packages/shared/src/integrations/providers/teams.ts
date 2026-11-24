/**
 * @atlas
 * @kind registry
 * @partOf feature:integrations
 * @uses none
 */
import { plainResourceKind } from '@template/shared/integrations/plainResourceKind';
import type { ResourceKind } from '@template/shared/integrations/resourceKind';

export const teamsResourceKinds: Record<string, ResourceKind> = {
  channel: plainResourceKind,
};

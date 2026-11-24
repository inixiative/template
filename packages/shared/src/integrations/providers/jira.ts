/**
 * @atlas
 * @kind registry
 * @partOf feature:integrations
 * @uses none
 */
import { plainResourceKind } from '@template/shared/integrations/plainResourceKind';
import type { ResourceKind } from '@template/shared/integrations/resourceKind';

export const jiraResourceKinds: Record<string, ResourceKind> = {
  issue: plainResourceKind,
};

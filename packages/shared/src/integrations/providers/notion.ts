/**
 * @atlas
 * @kind registry
 * @partOf feature:integrations
 * @uses none
 */
import {
  type ProviderResourceKinds,
  plainResourceKind,
} from '@template/shared/integrations/resourceKindDefinition';

export const notionResourceKinds: ProviderResourceKinds = {
  page: plainResourceKind,
};

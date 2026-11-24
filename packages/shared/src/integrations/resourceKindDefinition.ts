/**
 * @atlas
 * @kind query
 * @partOf feature:integrations
 * @uses none
 */
import type { Provider } from '@template/db/generated/client/enums';
import { plainResourceKind } from '@template/shared/integrations/plainResourceKind';
import { providerResourceKinds } from '@template/shared/integrations/providerResourceKinds';
import type { ResourceKind } from '@template/shared/integrations/resourceKind';

export const resourceKindDefinition = (
  provider: Provider | null,
  kind: string,
): ResourceKind | undefined => {
  if (!provider) return plainResourceKind;
  if (!Object.hasOwn(providerResourceKinds[provider], kind)) return undefined;
  return providerResourceKinds[provider][kind];
};

/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared
 * @uses none
 */

import type { Provider } from '@template/db/generated/client/enums';

export type IntegrationSingletonScope = 'owner' | 'project';

export const INTEGRATION_SINGLETONS: Partial<
  Record<Provider, readonly IntegrationSingletonScope[]>
> = {
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific singleton providers below
  // ==========================================================================
};

export const isIntegrationSingleton = (
  provider: Provider | null | undefined,
  scope: IntegrationSingletonScope,
): boolean => !!provider && (INTEGRATION_SINGLETONS[provider]?.includes(scope) ?? false);

/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared
 * @uses none
 */

import type { Provider } from '@template/db/generated/client/enums';

export type IntegrationOnePerScope = 'owner' | 'project';

export const INTEGRATION_ONE_PER: Partial<Record<Provider, readonly IntegrationOnePerScope[]>> = {
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific one-per providers below
  // ==========================================================================
};

export const isIntegrationOnePer = (
  provider: Provider | null | undefined,
  scope: IntegrationOnePerScope,
): boolean => !!provider && (INTEGRATION_ONE_PER[provider]?.includes(scope) ?? false);

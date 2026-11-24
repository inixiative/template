/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared
 * @uses none
 */

export type IntegrationSingletonScope = 'owner' | 'project';

/**
 * Providers that allow only one live integration per owner (`owner`), or only one live link per
 * project (`project`). A provider not listed allows many of both. Keys mirror Prisma `Provider`
 * (verified by packages/db/src/sharedEnumMirrors.test.ts).
 */
export const INTEGRATION_SINGLETONS: Partial<Record<string, readonly IntegrationSingletonScope[]>> =
  {
    // ==========================================================================
    // TEMPLATE ABOVE — Add app-specific singleton providers below
    // ==========================================================================
  };

export const isIntegrationSingleton = (
  provider: string | null | undefined,
  scope: IntegrationSingletonScope,
): boolean => !!provider && (INTEGRATION_SINGLETONS[provider]?.includes(scope) ?? false);

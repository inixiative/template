/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { providerFamily } from '@inixiative/integrations/catalog/providerFamily';
import type { SettingResourceKinds } from '@template/shared/settings/types';

/** The `provider:` and `family:` kinds of an Integration, or of a ProjectIntegration through its integration. */
export const settingKindsOfProvider = (
  provider: string | null | undefined,
): SettingResourceKinds => ({
  provider,
  family: providerFamily(provider),
});

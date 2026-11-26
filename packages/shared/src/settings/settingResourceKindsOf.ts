/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { providerFamily } from '@inixiative/integrations/catalog/providerFamily';
import type { SettingResourceModelName } from '@template/shared/settings/resourceModels';
import type { SettingResourceKinds } from '@template/shared/settings/types';

export const settingResourceKindsOf = (
  resourceModel: SettingResourceModelName,
  integrationProvider: string | null | undefined,
): SettingResourceKinds =>
  resourceModel === 'Integration' || resourceModel === 'ProjectIntegration'
    ? { provider: integrationProvider, family: providerFamily(integrationProvider) }
    : {};

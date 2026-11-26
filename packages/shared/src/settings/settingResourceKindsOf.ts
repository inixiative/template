/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import type { Provider } from '@template/db/generated/client/enums';
import type { SettingResourceModelName } from '@template/shared/settings/resourceModels';
import type { SettingResourceKinds } from '@template/shared/settings/types';

export const settingResourceKindsOf = (
  resourceModel: SettingResourceModelName,
  integrationProvider: Provider | null | undefined,
): SettingResourceKinds =>
  resourceModel === 'Integration' || resourceModel === 'ProjectIntegration'
    ? { provider: integrationProvider }
    : {};

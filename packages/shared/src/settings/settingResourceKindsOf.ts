/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { findProvider } from '@inixiative/integrations/catalog/findProvider';
import type { Provider } from '@template/db/generated/client/enums';
import type { SettingResourceModelName } from '@template/shared/settings/resourceModels';
import type { SettingResourceKinds } from '@template/shared/settings/types';

export const settingResourceKindsOf = (
  resourceModel: SettingResourceModelName,
  integrationProvider: Provider | null | undefined,
): SettingResourceKinds =>
  resourceModel === 'Integration' || resourceModel === 'ProjectIntegration'
    ? {
        provider: integrationProvider,
        integrationFamily: findProvider(integrationProvider)?.family ?? null,
      }
    : {};

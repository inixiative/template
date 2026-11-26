/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses infrastructure:prisma
 */
import {
  fetchSettingResourceKinds,
  type SettingResourceRef,
} from '@template/db/lib/settings/fetchSettingResourceKinds';
import {
  type SettingDefinition,
  type SettingResourceModelName,
  settingDefinitionForResource,
} from '@template/shared/settings';

/** The definition the setting row's own resource holds for its key, given that resource's kinds. */
export const fetchSettingDefinitionForRow = async (
  row: Record<string, unknown>,
): Promise<SettingDefinition | undefined> => {
  const resource = row as SettingResourceRef;
  if (typeof row.key !== 'string' || !resource.resourceModel) return undefined;
  return settingDefinitionForResource(
    resource.resourceModel as SettingResourceModelName,
    await fetchSettingResourceKinds(resource),
    row.key,
  );
};

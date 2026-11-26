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
  SETTING_TREES,
  type Setting,
  type SettingResourceModelName,
  settingAt,
} from '@template/shared/settings';

export const fetchSettingDefinitionForRow = async (
  row: Record<string, unknown>,
): Promise<Setting | undefined> => {
  const resource = row as SettingResourceRef;
  if (typeof row.key !== 'string' || !resource.resourceModel) return undefined;
  const tree = SETTING_TREES[resource.resourceModel as SettingResourceModelName];
  return settingAt(tree, row.key, await fetchSettingResourceKinds(resource));
};

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
  settingDefinitionsForResource,
} from '@template/shared/settings';

export const fetchSettingDefinitionForRow = async (
  row: Record<string, unknown>,
): Promise<SettingDefinition | undefined> => {
  const resource = row as SettingResourceRef;
  if (typeof row.key !== 'string' || !resource.resourceModel) return undefined;
  const kinds = await fetchSettingResourceKinds(resource);
  return settingDefinitionsForResource(
    resource.resourceModel as SettingResourceModelName,
    kinds,
  ).find((definition) => definition.key === row.key);
};

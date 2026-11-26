/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { isSettingLeaf } from '@template/shared/settings/isSettingLeaf';
import { settingAt } from '@template/shared/settings/settingAt';
import { settingChildrenFor } from '@template/shared/settings/settingChildrenFor';
import { settingNodesAlongKey } from '@template/shared/settings/settingNodesAlongKey';
import type {
  SettingBranch,
  SettingDefinition,
  SettingResourceKinds,
  SettingTree,
} from '@template/shared/settings/types';

const keysUnder = (
  branch: SettingBranch,
  kinds: SettingResourceKinds | 'every',
  prefix: string,
): string[] =>
  Object.entries(settingChildrenFor(branch, kinds)).flatMap(([name, node]) =>
    isSettingLeaf(node) ? [prefix + name] : keysUnder(node, kinds, `${prefix}${name}.`),
  );

export const settingsIn = (
  tree: SettingTree,
  kinds: SettingResourceKinds | 'every',
  path = '',
): SettingDefinition[] => {
  const node = settingNodesAlongKey(tree, path, kinds)?.at(-1);
  if (!node) return [];
  const keys = isSettingLeaf(node) ? [path] : keysUnder(node, kinds, path ? `${path}.` : '');
  return keys.map((key) => settingAt(tree, key, kinds) as SettingDefinition);
};

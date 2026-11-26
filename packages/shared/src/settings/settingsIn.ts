/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { settingAt } from '@template/shared/settings/settingAt';
import { settingChildrenFor } from '@template/shared/settings/settingChildrenFor';
import type {
  Setting,
  SettingBranch,
  SettingResourceKinds,
  SettingTree,
} from '@template/shared/settings/types';

const keysUnder = (
  branch: SettingBranch,
  kinds: SettingResourceKinds | 'every',
  prefix: string,
): string[] =>
  Object.entries(settingChildrenFor(branch, kinds)).flatMap(([name, node]) =>
    'valueType' in node ? [prefix + name] : keysUnder(node, kinds, `${prefix}${name}.`),
  );

export const settingsIn = (tree: SettingTree, kinds: SettingResourceKinds | 'every'): Setting[] =>
  keysUnder(tree, kinds, '').map((key) => settingAt(tree, key, kinds) as Setting);

/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { settingChildrenFor } from '@template/shared/settings/settingChildrenFor';
import type {
  Setting,
  SettingBranch,
  SettingLeaf,
  SettingNode,
  SettingResourceKinds,
  SettingTree,
} from '@template/shared/settings/types';

export const settingAt = (
  tree: SettingTree,
  key: string,
  kinds: SettingResourceKinds | 'every',
): Setting | undefined => {
  const path: SettingNode[] = [tree];
  for (const segment of key.split('.')) {
    const parent = path.at(-1) as SettingNode;
    if ('valueType' in parent) return undefined;
    const child = settingChildrenFor(parent as SettingBranch, kinds)[segment];
    if (!child) return undefined;
    path.push(child);
  }
  const leaf = path.at(-1) as SettingNode;
  if (!('valueType' in leaf)) return undefined;
  const { __read, __manage, ...setting } = leaf as SettingLeaf;

  let read: Setting['read'] | undefined;
  let manage: Setting['manage'] | undefined;
  for (const node of path.reverse()) {
    read ??= node.__read;
    manage ??= node.__manage;
  }
  return { ...setting, key, read: read as Setting['read'], manage: manage as Setting['manage'] };
};

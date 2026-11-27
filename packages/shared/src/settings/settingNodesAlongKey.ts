/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { isSettingLeaf } from '@template/shared/settings/isSettingLeaf';
import { settingChildrenFor } from '@template/shared/settings/settingChildrenFor';
import type {
  SettingNode,
  SettingResourceKinds,
  SettingTree,
} from '@template/shared/settings/types';

export const settingNodesAlongKey = (
  tree: SettingTree,
  key: string,
  kinds: SettingResourceKinds | 'every',
): SettingNode[] | undefined => {
  const nodes: SettingNode[] = [tree];
  for (const segment of key ? key.split('.') : []) {
    const parent = nodes.at(-1);
    if (!parent || isSettingLeaf(parent)) return undefined;
    const child = settingChildrenFor(parent, kinds)[segment];
    if (!child) return undefined;
    nodes.push(child);
  }
  return nodes;
};

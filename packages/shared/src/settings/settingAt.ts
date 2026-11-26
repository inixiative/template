/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { isSettingLeaf } from '@template/shared/settings/isSettingLeaf';
import { settingNodesAlongKey } from '@template/shared/settings/settingNodesAlongKey';
import type {
  SettingDefinition,
  SettingResourceKinds,
  SettingTree,
} from '@template/shared/settings/types';

export const settingAt = (
  tree: SettingTree,
  key: string,
  kinds: SettingResourceKinds | 'every',
): SettingDefinition | undefined => {
  const nodesAlongKey = settingNodesAlongKey(tree, key, kinds);
  const leaf = nodesAlongKey?.at(-1);
  if (!key || !nodesAlongKey || !isSettingLeaf(leaf)) return undefined;
  const { __read, __manage, ...setting } = leaf;

  let read: SettingDefinition['read'] | undefined;
  let manage: SettingDefinition['manage'] | undefined;
  for (const node of nodesAlongKey.reverse()) {
    read ??= node.__read;
    manage ??= node.__manage;
  }
  return {
    ...setting,
    key,
    read: read as SettingDefinition['read'],
    manage: manage as SettingDefinition['manage'],
  };
};

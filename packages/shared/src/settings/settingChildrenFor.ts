/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */

import { isSettingLeaf } from '@template/shared/settings/isSettingLeaf';
import type {
  SettingBranch,
  SettingNode,
  SettingResourceKinds,
} from '@template/shared/settings/types';
import { omit, pick, pickBy } from 'lodash-es';

const PERMISSION_KEYS = ['__read', '__manage'] as const;

const isChildEntry = (entry: [string, unknown]): entry is [string, SettingNode] =>
  !entry[0].startsWith('__') && !!entry[1] && typeof entry[1] === 'object';

const kindMatches = (name: string, kinds: SettingResourceKinds | 'every') => {
  const field = name.slice(0, name.indexOf(':'));
  return kinds === 'every' || kinds[field] === name.slice(field.length + 1);
};

const withPermissionsOf = (branch: SettingBranch, node: SettingNode): SettingNode =>
  ({ ...pickBy(pick(branch, PERMISSION_KEYS), Boolean), ...node }) as SettingNode;

const permissionsPushedToChildren = (branch: SettingBranch): SettingBranch => {
  const pushed: Record<string, unknown> = omit(branch, PERMISSION_KEYS);
  for (const [name, child] of Object.entries(branch).filter(isChildEntry))
    pushed[name] = withPermissionsOf(branch, child);
  return pushed as SettingBranch;
};

const mergedBranches = (placed: SettingBranch, node: SettingBranch): SettingBranch => {
  const merged: Record<string, unknown> = { ...permissionsPushedToChildren(placed) };
  for (const [name, child] of Object.entries(permissionsPushedToChildren(node))) {
    if (name.startsWith('__')) merged[name] ??= child;
    else mergeChild(merged as Record<string, SettingNode>, name, child as SettingNode);
  }
  return merged as SettingBranch;
};

const mergeChild = (into: Record<string, SettingNode>, name: string, node: SettingNode) => {
  const placed = into[name];
  if (!placed) into[name] = node;
  else if (!isSettingLeaf(placed) && !isSettingLeaf(node))
    into[name] = mergedBranches(placed as SettingBranch, node as SettingBranch);
};

export const settingChildrenFor = (
  branch: SettingBranch,
  kinds: SettingResourceKinds | 'every',
): Record<string, SettingNode> => {
  const children: Record<string, SettingNode> = {};
  for (const [name, node] of Object.entries(branch).filter(isChildEntry)) {
    if (!name.includes(':')) mergeChild(children, name, node);
    else if (kindMatches(name, kinds))
      for (const [childName, child] of Object.entries(
        settingChildrenFor(node as SettingBranch, kinds),
      ))
        mergeChild(children, childName, withPermissionsOf(node as SettingBranch, child));
  }
  return children;
};

/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import type {
  SettingBranch,
  SettingNode,
  SettingResourceKinds,
} from '@template/shared/settings/types';
import { pick, pickBy } from 'lodash-es';

const kindMatches = (name: string, kinds: SettingResourceKinds | 'every') => {
  const [field, value] = name.split(':');
  return kinds === 'every' || kinds[field as string] === value;
};

const mergeChild = (into: Record<string, SettingNode>, name: string, node: SettingNode) => {
  const placed = into[name];
  into[name] = placed && !('valueType' in placed) ? { ...placed, ...node } : (placed ?? node);
};

export const settingChildrenFor = (
  branch: SettingBranch,
  kinds: SettingResourceKinds | 'every',
): Record<string, SettingNode> => {
  const children: Record<string, SettingNode> = {};
  for (const [name, node] of Object.entries(branch)) {
    if (name.startsWith('__') || !node || typeof node !== 'object') continue;
    if (!name.includes(':')) mergeChild(children, name, node);
    else if (kindMatches(name, kinds)) {
      const kindPermissions = pickBy(pick(node as SettingBranch, ['__read', '__manage']), Boolean);
      for (const [childName, child] of Object.entries(
        settingChildrenFor(node as SettingBranch, kinds),
      ))
        mergeChild(children, childName, { ...kindPermissions, ...child } as SettingNode);
    }
  }
  return children;
};

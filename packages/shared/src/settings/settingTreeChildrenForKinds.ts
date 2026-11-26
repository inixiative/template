/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { settingTreeEntries } from '@template/shared/settings/settingTreeNodes';
import type {
  SettingBranch,
  SettingLeaf,
  SettingResourceKinds,
  SettingSchema,
} from '@template/shared/settings/types';

export type SettingTreeChild<TSchema = SettingSchema> =
  | { readonly kind: 'leaf'; readonly name: string; readonly node: SettingLeaf<TSchema> }
  | { readonly kind: 'branch'; readonly name: string; readonly node: SettingBranch<TSchema> };

const collectChildren = <TSchema>(
  branch: SettingBranch<TSchema>,
  kinds: SettingResourceKinds,
  into: Map<string, SettingTreeChild<TSchema>>,
): void => {
  for (const entry of settingTreeEntries(branch)) {
    if (entry.kind === 'meta') continue;
    if (entry.kind === 'kind') {
      if (kinds[entry.field] === entry.value) collectChildren(entry.node, kinds, into);
      continue;
    }
    const placed = into.get(entry.name);
    if (placed?.kind === 'branch' && entry.kind === 'branch')
      into.set(entry.name, { ...entry, node: { ...placed.node, ...entry.node } });
    else if (!placed) into.set(entry.name, entry);
  }
};

export const settingTreeChildrenForKinds = <TSchema>(
  branch: SettingBranch<TSchema>,
  kinds: SettingResourceKinds,
): SettingTreeChild<TSchema>[] => {
  const into = new Map<string, SettingTreeChild<TSchema>>();
  collectChildren(branch, kinds, into);
  return [...into.values()];
};

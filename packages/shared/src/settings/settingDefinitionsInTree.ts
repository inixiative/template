/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import type { SettingPermissionAction } from '@template/shared/settings/resourceModels';
import { settingTreeEntries } from '@template/shared/settings/settingTreeNodes';
import type {
  SettingBranch,
  SettingDefinition,
  SettingResourceKinds,
  SettingTree,
} from '@template/shared/settings/types';

type Inherited = { read: SettingPermissionAction; manage: SettingPermissionAction };

const collect = <TSchema>(
  branch: SettingBranch<TSchema>,
  path: readonly string[],
  inherited: Inherited,
  kinds: SettingResourceKinds | 'every',
  into: SettingDefinition<TSchema>[],
): void => {
  const here = {
    read: branch.__read ?? inherited.read,
    manage: branch.__manage ?? inherited.manage,
  };
  for (const entry of settingTreeEntries(branch)) {
    if (entry.kind === 'meta') continue;
    if (entry.kind === 'kind') {
      if (kinds === 'every' || kinds[entry.field] === entry.value)
        collect(entry.node, path, here, kinds, into);
      continue;
    }
    const childPath = [...path, entry.name];
    if (entry.kind === 'branch') {
      collect(entry.node, childPath, here, kinds, into);
      continue;
    }
    const { __read, __manage, ...leaf } = entry.node;
    into.push({
      ...leaf,
      key: childPath.join('.'),
      read: __read ?? here.read,
      manage: __manage ?? here.manage,
    });
  }
};

/**
 * Every setting a tree defines for a resource whose kind fields are `kinds`, in declaration order.
 * `'every'` includes every `field:value` branch: what the tree can ever hold.
 */
export const settingDefinitionsInTree = <TSchema>(
  tree: SettingTree<TSchema>,
  kinds: SettingResourceKinds | 'every',
): SettingDefinition<TSchema>[] => {
  const into: SettingDefinition<TSchema>[] = [];
  collect(tree, [], { read: tree.__read, manage: tree.__manage }, kinds, into);
  return into;
};

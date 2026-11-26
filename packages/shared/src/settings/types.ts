/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */
import type { AttributeValueRules, AttributeValueType } from '@template/shared/attributes';
import type {
  SettingPermissionAction,
  SettingResourceModelName,
} from '@template/shared/settings/resourceModels';

type SettingPermissions = {
  readonly __read?: SettingPermissionAction;
  readonly __manage?: SettingPermissionAction;
};

export type SettingLeaf = AttributeValueRules &
  SettingPermissions & {
    readonly valueType: Exclude<AttributeValueType, 'json'>;
    readonly defaultValue: unknown;
    readonly label: string;
    readonly description: string;
  };

export type SettingBranch = SettingPermissions & {
  readonly __label?: string;
  readonly [child: string]: SettingNode | string | undefined;
};

export type SettingNode = SettingLeaf | SettingBranch;

export type SettingTree = SettingBranch & Required<SettingPermissions>;

export type SettingTrees = Readonly<Record<SettingResourceModelName, SettingTree>>;

export type SettingResourceKinds = Readonly<Record<string, string | null | undefined>>;

export type Setting = Omit<SettingLeaf, '__read' | '__manage'> & {
  readonly key: string;
  readonly read: SettingPermissionAction;
  readonly manage: SettingPermissionAction;
};

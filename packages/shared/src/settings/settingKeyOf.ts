/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */
import type { SETTING_TREES } from '@template/shared/settings/trees';

type KeysIn<Node> = {
  [Name in keyof Node & string]: Name extends `__${string}`
    ? never
    : Name extends `${string}:${string}`
      ? KeysIn<Node[Name]>
      : Node[Name] extends { valueType: string }
        ? Name
        : `${Name}.${KeysIn<Node[Name]>}`;
}[keyof Node & string];

export type SettingKeyOf<Model extends keyof typeof SETTING_TREES> = KeysIn<
  (typeof SETTING_TREES)[Model]
>;

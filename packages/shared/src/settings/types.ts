/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */
import type { AttributeValueType } from '@template/shared/attributes';
import type {
  SettingPermissionAction,
  SettingResourceModelName,
} from '@template/shared/settings/resourceModels';
import type { z } from 'zod';

export type SettingSchema = z.ZodType<unknown>;

export type SettingJsonSchema = Record<string, unknown>;

export type SettingLeaf<TSchema = SettingSchema> = {
  readonly valueType: AttributeValueType;
  readonly schema: TSchema;
  readonly defaultValue: unknown;
  readonly label: string;
  readonly description: string;
  readonly __read?: SettingPermissionAction;
  readonly __manage?: SettingPermissionAction;
};

export type SettingBranch<TSchema = SettingSchema> = {
  readonly __label?: string;
  readonly __read?: SettingPermissionAction;
  readonly __manage?: SettingPermissionAction;
  readonly [child: string]: SettingNode<TSchema> | string | undefined;
};

export type SettingNode<TSchema = SettingSchema> = SettingLeaf<TSchema> | SettingBranch<TSchema>;

export type SettingTree<TSchema = SettingSchema> = SettingBranch<TSchema> & {
  readonly __read: SettingPermissionAction;
  readonly __manage: SettingPermissionAction;
};

export type SettingTrees<TSchema = SettingSchema> = Readonly<
  Record<SettingResourceModelName, SettingTree<TSchema>>
>;

export type SettingResourceKinds = Readonly<Record<string, string | null | undefined>>;

export type SettingDefinition<TSchema = SettingSchema> = {
  readonly key: string;
  readonly valueType: AttributeValueType;
  readonly schema: TSchema;
  readonly defaultValue: unknown;
  readonly label: string;
  readonly description: string;
  readonly read: SettingPermissionAction;
  readonly manage: SettingPermissionAction;
};

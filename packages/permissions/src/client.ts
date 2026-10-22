/**
 * @atlas
 * @kind client
 * @partOf primitive:authz
 * @uses none
 */
import {
  createPermissions as createLibraryPermissions,
  type ActionState as LibraryActionState,
  type Entitlements as LibraryEntitlements,
  type PermissionEntry as LibraryPermissionEntry,
  type Permix as LibraryPermix,
} from '@inixiative/permissions';
import type { TemplateActor } from '@template/permissions/actor';

// Base actions - most resources use these
export const StandardAction = {
  read: 'read',
  operate: 'operate',
  manage: 'manage',
  own: 'own',
} as const;
export type StandardAction = (typeof StandardAction)[keyof typeof StandardAction];

// Resource-specific actions (extend StandardAction, can add more)
export const OrganizationAction = { ...StandardAction } as const;
export type OrganizationAction = (typeof OrganizationAction)[keyof typeof OrganizationAction];

export const SpaceAction = { ...StandardAction } as const;
export type SpaceAction = (typeof SpaceAction)[keyof typeof SpaceAction];

export const SessionAction = {
  createToken: 'token.create',
  deleteToken: 'token.delete',
  redactUser: 'user.redact',
  rotateUserJwts: 'user.rotateJwts',
  deleteOrganization: 'organization.delete',
} as const;
export type SessionAction = (typeof SessionAction)[keyof typeof SessionAction];

export const MembershipAction = {
  own: 'membership.own',
  manage: 'membership.manage',
  operate: 'membership.operate',
  read: 'membership.read',
} as const;
export type MembershipAction = (typeof MembershipAction)[keyof typeof MembershipAction];

export const UserAction = {
  ...StandardAction,
  ...SessionAction,
  identify: 'user.identify',
  createOrganization: 'organization.create',
} as const;
export type UserAction = (typeof UserAction)[keyof typeof UserAction];

export const InquiryAction = {
  read: 'read',
  send: 'send',
  resolve: 'resolve',
  revoke: 'revoke',
} as const;
export type InquiryAction = (typeof InquiryAction)[keyof typeof InquiryAction];

export type CustomAction = `${string}.${string}`;

export type Action =
  | UserAction
  | OrganizationAction
  | SpaceAction
  | InquiryAction
  | MembershipAction
  | CustomAction;

export type Entitlements = LibraryEntitlements;
export type ActionState = LibraryActionState<Action>;
export type PermissionEntry = LibraryPermissionEntry<Action>;
export type Permix = LibraryPermix<Action, TemplateActor>;

export const createPermissions = (): Permix => createLibraryPermissions<Action, TemplateActor>();

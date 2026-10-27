/**
 * @atlas
 * @kind client
 * @partOf primitive:authz
 * @uses none
 */
import {
  createPermissions as createEnginePermissions,
  type ActionState as EngineActionState,
  type EntitlementEntry as EngineEntitlementEntry,
  type PermissionEntry as EnginePermissionEntry,
  type Permix as EnginePermix,
  type PermixLike,
} from '@inixiative/permissions';

// Base actions - most resources use these
export const StandardAction = {
  read: 'read',
  operate: 'operate',
  manage: 'manage',
  own: 'own',
} as const;
export type StandardAction = (typeof StandardAction)[keyof typeof StandardAction];

// Resource-specific actions (extend StandardAction, can add more)
export const OrganizationAction = {
  ...StandardAction,
  create: 'create',
  delete: 'delete',
} as const;
export type OrganizationAction = (typeof OrganizationAction)[keyof typeof OrganizationAction];

export const SpaceAction = { ...StandardAction } as const;
export type SpaceAction = (typeof SpaceAction)[keyof typeof SpaceAction];

export const UserAction = {
  ...StandardAction,
  redactUser: 'user.redact',
  rotateUserJwts: 'user.rotateJwts',
  changePassword: 'user.changePassword',
} as const;
export type UserAction = (typeof UserAction)[keyof typeof UserAction];

export const TokenAction = { create: 'create', delete: 'delete' } as const;
export type TokenAction = (typeof TokenAction)[keyof typeof TokenAction];

export const InquiryAction = {
  read: 'read',
  send: 'send',
  resolve: 'resolve',
} as const;
export type InquiryAction = (typeof InquiryAction)[keyof typeof InquiryAction];

export type Action = UserAction | OrganizationAction | SpaceAction | TokenAction | InquiryAction;

export const ActorModel = { User: 'User', Token: 'Token' } as const;
export type ActorModel = (typeof ActorModel)[keyof typeof ActorModel];

// Who is acting: a user or a token, and its row. A rule reads it as `__actor`.
export type Actor = { model: ActorModel; record: Record<string, unknown> };

export type ActionState = EngineActionState<Action>;
export type PermissionEntry = EnginePermissionEntry<Action>;
export type EntitlementEntry = EngineEntitlementEntry<Action>;
// The engine reads any permix back through PermixLike (string actions); ours narrows them to Action.
export type Permix = EnginePermix<Action, Actor> & PermixLike;

export const createPermissions = (): Permix => createEnginePermissions<Action, Actor>() as Permix;

/**
 * @atlas
 * @kind client
 * @partOf primitive:authz
 * @uses none
 */
import type { UserId } from '@template/db';
import { castArray } from 'lodash-es';
import { createPermix, type PermixRules } from 'permix';

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

export const UserAction = { ...StandardAction } as const;
export type UserAction = (typeof UserAction)[keyof typeof UserAction];

export const InquiryAction = {
  read: 'read',
  send: 'send',
  resolve: 'resolve',
} as const;
export type InquiryAction = (typeof InquiryAction)[keyof typeof InquiryAction];

export type Action = UserAction | OrganizationAction | SpaceAction | InquiryAction;

export type Entitlements = Record<string, boolean> | null;

export type ActionState = Partial<Record<Action, boolean | ((data?: unknown) => boolean)>>;
export type PermissionEntry = { resource: string; id?: string; actions: ActionState };
type PermissionDefinition = Record<string, { action: Action }>;

const deniedActions: Record<Action, false> = {
  read: false,
  operate: false,
  manage: false,
  own: false,
  send: false,
  resolve: false,
};

export type Permix = {
  check: (resource: string, action: Action, id?: string, data?: unknown) => boolean;
  setup: (
    perms: PermissionEntry | PermissionEntry[],
    options?: { replace?: boolean },
  ) => Promise<void>;
  setSuperadmin: (value: boolean) => void;
  isSuperadmin: () => boolean;
  setUserId: (id: UserId) => void;
  getUserId: () => UserId | null;
  getJSON: () => Record<string, Record<string, boolean>> | null;
};

export const createPermissions = (): Permix => {
  const permix = createPermix<PermissionDefinition>();
  let isSuperadmin = false;
  let userId: UserId | null = null;
  let accumulated: PermixRules<PermissionDefinition> = {};

  return {
    check: (resource, action, id, data) => {
      if (isSuperadmin) return true;
      const key = id ? `${resource}:${id}` : resource;
      return permix.check(key, action, data);
    },
    setup: async (perms, options) => {
      if (options?.replace) accumulated = {};

      const entries = castArray(perms);
      for (const { resource, id, actions } of entries) {
        const key = id ? `${resource}:${id}` : resource;
        accumulated[key] = { ...deniedActions, ...actions };
      }
      await permix.setup(accumulated);
    },
    setSuperadmin: (value) => {
      isSuperadmin = value;
    },
    isSuperadmin: () => isSuperadmin,
    setUserId: (id) => {
      userId = id;
    },
    getUserId: () => userId,
    getJSON: () => permix.dehydrate() as Record<string, Record<string, boolean>>,
  };
};

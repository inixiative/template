import { createPermix } from 'permix';

export type ResourceType = 'organization' | 'user';

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

export const UserAction = { ...StandardAction } as const;
export type UserAction = (typeof UserAction)[keyof typeof UserAction];

export type Action = UserAction | OrganizationAction;

export type Entitlements = Record<string, boolean> | null;

export type ActionState = Partial<Record<Action, boolean | ((data?: unknown) => boolean)>>;
export type PermissionEntry = { resource: ResourceType; id?: string; actions: ActionState };
type PermissionState = Record<string, ActionState>;

export type Permix = {
  check: (resource: ResourceType, action: Action, id?: string, data?: unknown) => boolean;
  setup: (perms: PermissionEntry | PermissionEntry[], options?: { replace?: boolean }) => Promise<void>;
  setSuperadmin: (value: boolean) => void;
  getJSON: () => Record<string, Record<string, boolean>> | null;
};

export const createPermissions = (): Permix => {
  const permix = createPermix<Record<string, { action: Action }>>();
  let isSuperadmin = false;
  let accumulated: PermissionState = {};

  return {
    check: (resource, action, id, data) => {
      if (isSuperadmin) return true;
      const key = id ? `${resource}:${id}` : resource;
      return permix.check(key, action, data);
    },
    setup: async (perms, options) => {
      if (options?.replace) accumulated = {};

      const entries = Array.isArray(perms) ? perms : [perms];
      for (const { resource, id, actions } of entries) {
        const key = id ? `${resource}:${id}` : resource;
        accumulated[key] = { ...actions };
      }
      await permix.setup(accumulated as any);
    },
    setSuperadmin: (value) => {
      isSuperadmin = value;
    },
    getJSON: () => permix.getJSON() as Record<string, Record<string, boolean>> | null,
  };
};

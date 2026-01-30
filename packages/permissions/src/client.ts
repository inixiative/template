import { createPermix } from 'permix';

export type ResourceType = 'organization' | 'space' | 'user';

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

export type Action = UserAction | OrganizationAction | SpaceAction;

export type Entitlements = Record<string, boolean> | null;

export type ActionState = Partial<Record<Action, boolean | ((data?: unknown) => boolean)>>;

// Context stored alongside permissions for inheritance lookups
export type PermissionContext = {
  organizationId?: string;
  spaceId?: string;
  [key: string]: unknown;
};

export type PermissionEntry = {
  resource: ResourceType;
  id?: string;
  actions: ActionState;
  context?: PermissionContext;
};

type PermissionState = Record<string, ActionState>;
type ContextState = Record<string, PermissionContext>;

export type Permix = {
  check: (resource: ResourceType, action: Action, id?: string, data?: unknown) => boolean;
  setup: (perms: PermissionEntry | PermissionEntry[], options?: { replace?: boolean }) => Promise<void>;
  setSuperadmin: (value: boolean) => void;
  getJSON: () => Record<string, Record<string, boolean>> | null;
  getContext: (resource: ResourceType, id?: string) => PermissionContext | null;
  isSuperadmin: () => boolean;
};

export const createPermissions = (): Permix => {
  const permix = createPermix<Record<string, { action: Action }>>();
  let superadmin = false;
  let accumulated: PermissionState = {};
  let contexts: ContextState = {};

  return {
    check: (resource, action, id, data) => {
      if (superadmin) return true;
      const key = id ? `${resource}:${id}` : resource;
      return permix.check(key, action, data);
    },
    setup: async (perms, options) => {
      if (options?.replace) {
        accumulated = {};
        contexts = {};
      }

      const entries = Array.isArray(perms) ? perms : [perms];
      for (const { resource, id, actions, context } of entries) {
        const key = id ? `${resource}:${id}` : resource;
        accumulated[key] = { ...actions };
        if (context) contexts[key] = context;
      }
      await permix.setup(accumulated as any);
    },
    setSuperadmin: (value) => {
      superadmin = value;
    },
    getJSON: () => permix.getJSON() as Record<string, Record<string, boolean>> | null,
    getContext: (resource, id) => {
      const key = id ? `${resource}:${id}` : resource;
      return contexts[key] ?? null;
    },
    isSuperadmin: () => superadmin,
  };
};

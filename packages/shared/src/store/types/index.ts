export * from './api';
export * from './auth';
export * from './navigation';
export * from './permissions';
export * from './tenant';
export * from './ui';

import type { ApiSlice } from './api';
import type { AuthSlice } from './auth';
import type { NavigationSlice } from './navigation';
import type { PermissionsSlice } from './permissions';
import type { TenantSlice } from './tenant';
import type { UISlice } from './ui';

export type AppStore = ApiSlice & AuthSlice & NavigationSlice & PermissionsSlice & TenantSlice & UISlice;

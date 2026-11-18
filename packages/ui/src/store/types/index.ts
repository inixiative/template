export * from '@template/ui/store/types/auth';
export * from '@template/ui/store/types/navigation';
export * from '@template/ui/store/types/permissions';
export * from '@template/ui/store/types/queryClientAndWebsocket';
export * from '@template/ui/store/types/tenant';
export * from '@template/ui/store/types/ui';

import type { AuthSlice } from '@template/ui/store/types/auth';
import type { NavigationSlice } from '@template/ui/store/types/navigation';
import type { PermissionsSlice } from '@template/ui/store/types/permissions';
import type { QueryClientAndWebsocketSlice } from '@template/ui/store/types/queryClientAndWebsocket';
import type { TenantSlice } from '@template/ui/store/types/tenant';
import type { UISlice } from '@template/ui/store/types/ui';

export type AppStore = QueryClientAndWebsocketSlice &
  AuthSlice &
  NavigationSlice &
  PermissionsSlice &
  TenantSlice &
  UISlice;

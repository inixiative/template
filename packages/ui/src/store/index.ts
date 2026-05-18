import { createAuthSlice } from '@template/ui/store/slices/auth';
import { createClientSlice } from '@template/ui/store/slices/client';
import { createNavigationSlice } from '@template/ui/store/slices/navigation';
import { createPermissionsSlice } from '@template/ui/store/slices/permissions';
import { createTenantSlice } from '@template/ui/store/slices/tenant';
import { createUISlice } from '@template/ui/store/slices/ui';
import type { AppStore } from '@template/ui/store/types';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createClientSlice(...a),
      ...createAuthSlice(...a),
      ...createNavigationSlice(...a),
      ...createPermissionsSlice(...a),
      ...createTenantSlice(...a),
      ...createUISlice(...a),
    }),
    { name: 'SharedAppStore' },
  ),
);

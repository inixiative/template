import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  createApiSlice,
  createAuthSlice,
  createUISlice,
  type ApiSlice,
  type AuthSlice,
  type UISlice,
} from '@template/shared';

export type AppStore = ApiSlice & AuthSlice & UISlice;

export const useAppStore = create<AppStore>()(
  devtools(
    (...a) => ({
      ...createApiSlice(...a),
      ...createAuthSlice(...a),
      ...createUISlice(...a),
    }),
    { name: 'SuperadminStore' },
  ),
);

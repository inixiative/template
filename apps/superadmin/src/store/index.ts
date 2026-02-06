import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  createApiSlice,
  createAuthSlice,
  type ApiSlice,
  type AuthSlice,
} from '@template/shared';

export type SuperadminStore = ApiSlice & AuthSlice;

export const useSuperadminStore = create<SuperadminStore>()(
  devtools(
    (...a) => ({
      ...createApiSlice(...a),
      ...createAuthSlice(...a),
    }),
    { name: 'SuperadminStore' },
  ),
);

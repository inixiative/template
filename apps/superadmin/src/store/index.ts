import { type ApiSlice, type AuthSlice, createApiSlice, createAuthSlice } from '@template/shared';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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

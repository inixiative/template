import { type AuthSlice, type ClientSlice, createAuthSlice, createClientSlice } from '@template/ui/store';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type SuperadminStore = ClientSlice & AuthSlice;

export const useSuperadminStore = create<SuperadminStore>()(
  devtools(
    (...a) => ({
      ...createClientSlice(...a),
      ...createAuthSlice(...a),
    }),
    { name: 'SuperadminStore' },
  ),
);

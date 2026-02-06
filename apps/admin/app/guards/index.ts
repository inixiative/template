import { createAuthGuards } from '@template/shared';
import { useAppStore } from '#/store';

export const { requireAuth, requireGuest } = createAuthGuards(() => useAppStore.getState());

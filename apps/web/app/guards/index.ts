import { createAuthGuards } from '@template/ui/guards';
import { useAppStore } from '#/store';

export const { requireAuth, requirePublic } = createAuthGuards(() => useAppStore.getState());

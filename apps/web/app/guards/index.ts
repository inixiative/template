import { createAuthGuards } from '@template/ui/guards';
import { useAppStore } from '@template/ui/store';

export const { requireAuth, requirePublic } = createAuthGuards(() => useAppStore.getState());

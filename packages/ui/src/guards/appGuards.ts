/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses none
 */
import { createAuthGuards } from '@template/ui/guards/authGuard';
import { useAppStore } from '@template/ui/store';

export const { requireAuth, requirePublic } = createAuthGuards(() => useAppStore.getState());

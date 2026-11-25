/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
import { createAuthGuards } from '@template/ui/guards/authGuard';
import { useAppStore } from '@template/ui/store';

export const {
  redirectToLoginUnlessAuthenticated,
  redirectUnlessTwoFactorRequired,
  redirectAuthenticatedUserAwayFromPublicPage,
} = createAuthGuards(() => useAppStore.getState());

/**
 * @atlas
 * @kind page
 * @partOf feature:users
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { ProfilePage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/settings/profile')({
  component: ProfilePage,
});

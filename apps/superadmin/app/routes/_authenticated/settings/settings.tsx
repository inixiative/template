/**
 * @atlas
 * @kind page
 * @partOf superadmin
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/settings/settings')({
  component: SettingsPage,
});

/**
 * @atlas
 * @kind page
 * @partOf feature:project
 * @uses primitive:ui
 */
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/projects')({
  component: Outlet,
});

/**
 * @atlas
 * @kind page
 * @partOf feature:segment
 * @uses primitive:ui
 */
import { createFileRoute } from '@tanstack/react-router';
import { SegmentsPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/segments')({
  component: SegmentsPage,
});

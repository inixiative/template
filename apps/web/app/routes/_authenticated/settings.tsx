import { createFileRoute } from '@tanstack/react-router';
import { redirectPreservingContext } from '@template/ui/lib';

export const Route = createFileRoute('/_authenticated/settings')({
  beforeLoad: (context) => redirectPreservingContext(context, '/settings/profile'),
});

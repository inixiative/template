import { createFileRoute } from '@tanstack/react-router';
import { TokensPage } from '@template/ui/pages';

export const Route = createFileRoute('/_authenticated/settings/tokens')({
  component: TokensPage,
});

import { redirect } from '@tanstack/react-router';
import { pickSearchParams } from '@template/ui/lib/searchParams';

type BeforeLoadContext = {
  location: {
    search: Record<string, unknown>;
  };
};

export const redirectPreservingContext = (context: BeforeLoadContext, to: string): never => {
  const preserved = pickSearchParams(context.location.search, ['org', 'space', 'spoof']);
  throw redirect({ to, search: preserved });
};

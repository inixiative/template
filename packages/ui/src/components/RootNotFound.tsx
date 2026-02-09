import { useLocation, useNavigate } from '@tanstack/react-router';
import { NotFound } from './NotFound';

type RootNotFoundProps = {
  title?: string;
  description?: string;
};

export const RootNotFound = ({
  title = 'Page not found',
  description = 'This route does not exist.'
}: RootNotFoundProps = {}): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoToDashboard = () => {
    const searchParams = new URLSearchParams(location.search);
    const org = searchParams.get('org');
    const space = searchParams.get('space');

    const contextSearch: Record<string, string> = {};
    if (org) contextSearch.org = org;
    if (space) contextSearch.space = space;

    navigate({ to: '/dashboard', search: contextSearch });
  };

  return (
    <NotFound
      title={title}
      description={description}
      actionLabel="Go to dashboard"
      onAction={handleGoToDashboard}
    />
  );
};

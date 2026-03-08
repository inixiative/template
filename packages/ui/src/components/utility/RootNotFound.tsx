import { NotFound } from '@template/ui/components/utility/NotFound';
import { useAppStore } from '@template/ui/store';

type RootNotFoundProps = {
  title?: string;
  description?: string;
};

export const RootNotFound = ({
  title = 'Page not found',
  description = 'This route does not exist.',
}: RootNotFoundProps = {}) => {
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);

  const handleGoToDashboard = () => {
    navigatePreservingContext('/dashboard');
  };

  return (
    <NotFound title={title} description={description} actionLabel="Go to dashboard" onAction={handleGoToDashboard} />
  );
};

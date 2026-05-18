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
  const navigatePreserving = useAppStore((state) => state.navigation.navigatePreserving);

  const handleGoToDashboard = () => {
    navigatePreserving('/dashboard', 'context');
  };

  return (
    <NotFound title={title} description={description} actionLabel="Go to dashboard" onAction={handleGoToDashboard} />
  );
};

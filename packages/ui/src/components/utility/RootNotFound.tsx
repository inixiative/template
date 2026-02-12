import { useAppStore } from '@template/ui/store';
import { NotFound } from '@template/ui/components/NotFound';

type RootNotFoundProps = {
  title?: string;
  description?: string;
};

export const RootNotFound = ({
  title = 'Page not found',
  description = 'This route does not exist.'
}: RootNotFoundProps = {}) => {
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);

  const handleGoToDashboard = () => {
    navigatePreservingContext('/dashboard');
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

/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
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
  const navigateKeepingSearchParams = useAppStore(
    (state) => state.navigation.navigateKeepingSearchParams,
  );

  const handleGoToDashboard = () => {
    navigateKeepingSearchParams('/dashboard', 'context');
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

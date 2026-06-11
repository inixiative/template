/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 */
import { Icon } from '@iconify/react';
import { Button } from '@template/ui/components';
import { useAppStore } from '@template/ui/store';

export const FullscreenLayout = ({ children }: { children: React.ReactNode }) => {
  const { navigatePreserving } = useAppStore((state) => state.navigation);

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigatePreserving('..', 'context')}
          className="bg-background/80 backdrop-blur-sm"
        >
          <Icon icon="lucide:arrow-left" className="h-5 w-5" />
        </Button>
      </div>
      <div className="h-full w-full">{children}</div>
    </div>
  );
};

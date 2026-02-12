import { ArrowLeft } from 'lucide-react';
import { Button } from '@template/ui/components';
import { useAppStore } from '@template/ui/store';

export const FullscreenLayout = ({ children }: { children: React.ReactNode }) => {
  const { navigatePreservingContext } = useAppStore((state) => state.navigation);

  return (
    <div className="min-h-screen w-full bg-background">
      <div className="fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigatePreservingContext('..')}
          className="bg-background/80 backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="h-full w-full">
        {children}
      </div>
    </div>
  );
};

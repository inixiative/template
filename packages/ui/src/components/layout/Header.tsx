import { useAppStore } from '@template/shared';
import { cn } from '@template/ui/lib/utils';
import { Menu } from 'lucide-react';
import { ShareButton } from '@template/ui/components/ShareButton';

export type HeaderProps = {
  onMenuClick?: () => void;
  className?: string;
};

export const Header = ({ onMenuClick, className }: HeaderProps) => {
  // Read from Zustand store
  const shortName = useAppStore((state) => state.ui.shortName);
  const context = useAppStore((state) => state.tenant.context);

  const logo = <div className="text-lg font-bold">{shortName}</div>;
  return (
    <header
      className={cn(
        'flex items-center justify-between h-16 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-accent rounded-md transition-colors"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {logo}
      </div>
      <div className="flex items-center gap-2">
        {context && context.type !== 'public' && <ShareButton />}
      </div>
    </header>
  );
};

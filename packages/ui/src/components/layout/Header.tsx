import { Menu } from 'lucide-react';
import { cn } from '@ui/lib/utils';

export type HeaderProps = {
  logo?: React.ReactNode;
  onMenuClick?: () => void;
  className?: string;
};

export const Header = ({ logo, onMenuClick, className }: HeaderProps) => {
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
    </header>
  );
};

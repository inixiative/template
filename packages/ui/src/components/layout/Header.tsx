/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { Breadcrumbs } from '@template/ui/components/layout/Breadcrumbs';
import { ShareButton } from '@template/ui/components/utility/ShareButton';
import { cn } from '@template/ui/lib/utils';
import { useAppStore } from '@template/ui/store';

export type HeaderProps = {
  onMenuClick?: () => void;
  brand?: React.ReactNode;
  className?: string;
};

export const Header = ({ onMenuClick, brand, className }: HeaderProps) => {
  const context = useAppStore((state) => state.tenant.context);

  return (
    <header
      className={cn(
        'flex items-center justify-between gap-4 h-14 px-4 lg:px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-accent rounded-md transition-colors"
            aria-label="Toggle menu"
          >
            <Icon icon="lucide:menu" className="h-5 w-5" />
          </button>
        )}
        {brand && <div className="shrink-0 text-base font-bold tracking-tight lg:hidden">{brand}</div>}
        <Breadcrumbs className="hidden min-w-0 sm:block" />
      </div>
      <div className="flex items-center gap-2">{context && context.type !== 'public' && <ShareButton />}</div>
    </header>
  );
};

import { ChevronRight } from 'lucide-react';
import { cn } from '@template/ui/lib/utils';
import { useBreadcrumbs } from '@template/ui/hooks';

export type BreadcrumbsProps = {
  className?: string;
};

export const Breadcrumbs = ({ className }: BreadcrumbsProps) => {
  const { items, onNavigate } = useBreadcrumbs();

  if (items.length === 0) return null;

  return (
    <nav className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={item.href} className="flex items-center gap-2">
            {isLast ? (
              <span className="text-foreground font-medium">{item.label}</span>
            ) : (
              <>
                <button
                  onClick={() => onNavigate(item.href)}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </button>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
};

import { Icon } from '@iconify/react';
import { useLocation } from '@tanstack/react-router';
import type { NavItem } from '@template/ui/components/layout/navigationTypes';
import { findRoute } from '@template/ui/lib/findRoute';
import { cn } from '@template/ui/lib/utils';
import { useAppStore } from '@template/ui/store';
import { useEffect, useMemo, useState } from 'react';

export type SidebarProps = {
  className?: string;
};

export const Sidebar = ({ className }: SidebarProps) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const location = useLocation();

  // Read from Zustand
  const permissions = useAppStore((state) => state.permissions);
  const tenant = useAppStore((state) => state.tenant);
  const navigatePreservingContext = useAppStore((state) => state.navigation.navigatePreservingContext);
  const navConfig = useAppStore((state) => state.navigation.navConfig);

  const context = tenant.context; // TenantContext with full objects
  const contextType = context.type;
  const items = navConfig?.[contextType] || [];

  // Find which items are in the active path
  const activeChain = useMemo(() => {
    if (!navConfig) return [];
    const match = findRoute(location.pathname, navConfig, contextType);
    return match?.chain || [];
  }, [location.pathname, navConfig, contextType]);

  // Auto-expand parent items when navigating to a child route
  useEffect(() => {
    if (activeChain.length > 1) {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        for (let i = 0; i < activeChain.length - 1; i++) {
          next.add(activeChain[i].label);
        }
        return next;
      });
    }
  }, [activeChain]);

  const toggleItem = (label: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  // Static map so Tailwind's JIT keeps these classes. Depth 0 has no extra
  // padding; each nested level adds another step to make the parent/child
  // hierarchy visible.
  const DEPTH_PADDING: Record<number, string> = { 1: 'pl-9', 2: 'pl-14', 3: 'pl-20' };

  const renderItem = (item: NavItem, depth: number = 0, parentPath: string = '') => {
    // Don't render if no access or if it's an alias (hidden from sidebar)
    if (item.alias) return null;
    if (item.access && !item.access(permissions, context)) return null;

    const fullPath = parentPath + (item.path || '');
    const hasChildren = item.items && item.items.length > 0;
    const isExpanded = expandedItems.has(item.label);
    const isActive = activeChain.includes(item);
    const iconSlug = item.icon;

    return (
      <div key={item.label}>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fullPath && navigatePreservingContext(fullPath)}
            className={cn(
              'flex-1 flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              DEPTH_PADDING[depth],
              isActive
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              !item.path && 'cursor-default',
            )}
          >
            {iconSlug && <Icon icon={iconSlug} className="h-4 w-4 shrink-0" />}
            <span className="flex-1 text-left truncate">{item.label}</span>
          </button>
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggleItem(item.label)}
              className="p-2 hover:bg-accent/50 rounded-md transition-colors"
            >
              {isExpanded ? (
                <Icon icon="lucide:chevron-down" className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Icon icon="lucide:chevron-right" className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">{item.items!.map((child) => renderItem(child, depth + 1, fullPath))}</div>
        )}
      </div>
    );
  };

  if (!navConfig) return null;
  if (items.length === 0) return null;

  return (
    <nav className={cn('flex flex-col gap-4 p-4', className)}>
      <div className="space-y-1">{items.map((item) => renderItem(item))}</div>
    </nav>
  );
};

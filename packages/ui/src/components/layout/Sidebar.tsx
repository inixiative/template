import { useLocation } from '@tanstack/react-router';
import { findRoute } from '@template/ui/lib/findRoute';
import { cn } from '@template/ui/lib/utils';
import { useAppStore } from '@template/ui/store';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { NavItem } from '@template/ui/components/layout/navigationTypes';

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

  const renderItem = (item: NavItem, depth: number = 0) => {
    // Don't render if no access or if it's an alias (hidden from sidebar)
    if (item.alias) return null;
    if (item.access && !item.access(permissions, context)) return null;

    const hasChildren = item.items && item.items.length > 0;
    const isExpanded = expandedItems.has(item.label);
    const isActive = activeChain.includes(item);
    const Icon = item.icon;

    return (
      <div key={item.label}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => item.path && navigatePreservingContext(item.path)}
            className={cn(
              'flex-1 flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              depth > 0 && 'pl-9',
              isActive
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              !item.path && 'cursor-default',
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span className="flex-1 text-left truncate">{item.label}</span>
          </button>
          {hasChildren && (
            <button
              onClick={() => toggleItem(item.label)}
              className="p-2 hover:bg-accent/50 rounded-md transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">{item.items!.map((child) => renderItem(child, depth + 1))}</div>
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

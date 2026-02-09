import { cn } from '@template/ui/lib/utils';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore, findRoute, type PageContext } from '@template/shared';

export type NavContext = {
  organization?: { id: string; name: string; [key: string]: unknown };
  space?: { id: string; name: string; organizationId?: string; [key: string]: unknown };
};

export type NavItem = {
  label: string;
  path?: string;
  icon?: LucideIcon;
  title?: string | ((context: NavContext, pageContext?: PageContext) => string);
  description?: string | ((context: NavContext, pageContext?: PageContext) => string);
  access?: (permissions: { check: (resource: string, entity: unknown, action: string) => boolean }, context: NavContext) => boolean;
  alias?: boolean;
  breadcrumbLabel?: (record: Record<string, any>) => string;
  items?: NavItem[];
};

export type NavConfig = {
  personal: NavItem[];
  organization: NavItem[];
  space: NavItem[];
  public?: NavItem[];
};

export type SidebarProps = {
  currentPath: string;
  className?: string;
};

export const Sidebar = ({ currentPath, className }: SidebarProps) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Read from Zustand
  const permissions = useAppStore((state) => state.permissions.permissions);
  const tenant = useAppStore((state) => state.tenant);
  const navigate = useAppStore((state) => state.navigation.navigate);
  const navConfig = useAppStore((state) => state.navigation.navConfig);

  const context = tenant.getCurrentContext();
  const contextType = context.type;
  const items = navConfig?.[contextType] || [];

  // Find which items are in the active path
  const activeChain = useMemo(() => {
    if (!navConfig) return [];
    const match = findRoute(currentPath, navConfig, contextType);
    return match?.chain || [];
  }, [currentPath, navConfig, contextType]);

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
            onClick={() => item.path && navigate?.({ to: item.path })}
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

  return (
    <nav className={cn('flex flex-col gap-4 p-4', className)}>
      <div className="space-y-1">{items.map((item) => renderItem(item))}</div>
    </nav>
  );
};

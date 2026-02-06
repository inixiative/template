import { useState } from 'react';
import { type LucideIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@ui/lib/utils';

export type NavContext = {
  organization?: any;
  space?: any;
};

export type NavItem = {
  label: string;
  path?: string;
  icon?: LucideIcon;
  can?: (permissions: any, context: NavContext) => boolean;
  items?: NavItem[];
};

export type SidebarSection = {
  label?: string;
  items: NavItem[];
};

export type SidebarProps = {
  sections: SidebarSection[];
  currentPath: string;
  permissions: any;
  context: NavContext;
  onNavigate: (path: string) => void;
  className?: string;
};

export const Sidebar = ({ sections, currentPath, permissions, context, onNavigate, className }: SidebarProps) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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
    if (item.can && !item.can(permissions, context)) return null;

    const hasChildren = item.items && item.items.length > 0;
    const isExpanded = expandedItems.has(item.label);
    const isActive = item.path === currentPath;
    const Icon = item.icon;

    return (
      <div key={item.label}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => item.path && onNavigate(item.path)}
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

  return (
    <nav className={cn('flex flex-col gap-6 p-4', className)}>
      {sections.map((section, idx) => (
        <div key={section.label || idx}>
          {section.label && (
            <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {section.label}
            </div>
          )}
          <div className="space-y-1">{section.items.map((item) => renderItem(item))}</div>
        </div>
      ))}
    </nav>
  );
};

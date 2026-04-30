import { Icon } from '@iconify/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@template/ui/components/primitives/DropdownMenu';
import { cn } from '@template/ui/lib/utils';
import { useAppStore } from '@template/ui/store';
import { useState } from 'react';

export type ContextType = 'user' | 'organization' | 'space' | 'public';

export type SpaceOption = {
  id: string;
  name: string;
};

export type OrganizationOption = {
  id: string;
  name: string;
  spaces?: SpaceOption[];
};

export type CurrentContext = {
  type: ContextType;
  label: string;
  organizationId?: string;
  spaceId?: string;
};

export type ContextSelectorProps = {
  onManageOrganizations?: () => void;
  locked?: boolean;
  className?: string;
};

export const ContextSelector = ({ onManageOrganizations, locked = false, className }: ContextSelectorProps) => {
  // Read from Zustand store
  const tenant = useAppStore((state) => state.tenant);
  const auth = useAppStore((state) => state.auth);

  const current = tenant.context;
  const organizations = Object.values(auth.organizations ?? {}).map((org) => ({
    id: org.id,
    name: org.name,
    spaces: Object.values(auth.spaces ?? {})
      .filter((space) => space.organizationId === org.id)
      .map((space) => ({ id: space.id, name: space.name })),
  }));

  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(current.organization?.id || null);

  // Generate label from context
  const currentLabel =
    current.type === 'organization'
      ? (current.organization?.name ?? 'Organization')
      : current.type === 'space'
        ? (current.space?.name ?? 'Space')
        : current.type === 'user'
          ? 'Personal'
          : 'Public';

  const toggleOrg = (orgId: string) => {
    setExpandedOrgId(expandedOrgId === orgId ? null : orgId);
  };

  if (locked) {
    return (
      <div className={cn('w-full', className)}>
        <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
          <div className="flex-1 text-left min-w-0">
            <div className="font-semibold truncate">{currentLabel}</div>
            <div className="text-xs text-muted-foreground capitalize">{current.type}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn('w-full', className)}>
        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors">
          <div className="flex-1 text-left min-w-0">
            <div className="font-semibold truncate">{currentLabel}</div>
            <div className="text-xs text-muted-foreground capitalize">{current.type}</div>
          </div>
          <Icon icon="lucide:chevrons-up-down" className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[280px]" align="start">
        <div className="max-h-[60vh] overflow-y-auto">
          {organizations.map((org) => {
            const isCurrentOrg = current.organization?.id === org.id && current.type === 'organization';
            const isExpanded = expandedOrgId === org.id;
            const spaces = org.spaces || [];

            // 0 spaces: directly switch to org context, no accordion
            if (spaces.length === 0) {
              return (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => tenant.setOrganization(org.id)}
                  className={cn('cursor-pointer', isCurrentOrg && 'bg-accent text-accent-foreground')}
                >
                  <Icon icon="lucide:building2" className="h-4 w-4 mr-2" />
                  <span className="flex-1 truncate">{org.name}</span>
                  {isCurrentOrg && <Icon icon="lucide:check" className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              );
            }

            // 1 space: directly switch to space context
            if (spaces.length === 1) {
              const space = spaces[0];
              const isCurrentSpace =
                current.organization?.id === org.id && current.space?.id === space.id && current.type === 'space';

              return (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => tenant.setSpace(space.id)}
                  className={cn('cursor-pointer', isCurrentSpace && 'bg-accent text-accent-foreground')}
                >
                  <Icon icon="lucide:building2" className="h-4 w-4 mr-2" />
                  <span className="flex-1 truncate">{space.name}</span>
                  {isCurrentSpace && <Icon icon="lucide:check" className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              );
            }

            // 2+ spaces: accordion — use plain div for toggle so dropdown stays open
            return (
              <div key={org.id}>
                {/* biome-ignore lint/a11y/noStaticElementInteractions: accordion toggle inside DropdownMenu, keyboard navigation handled by parent */}
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: accordion toggle inside DropdownMenu, keyboard navigation handled by parent */}
                <div
                  onClick={() => toggleOrg(org.id)}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon icon="lucide:building2" className="h-4 w-4 mr-2" />
                  <span className="flex-1 truncate">
                    {org.name} ({spaces.length})
                  </span>
                  {isExpanded ? (
                    <Icon icon="lucide:chevron-up" className="h-4 w-4" />
                  ) : (
                    <Icon icon="lucide:chevron-down" className="h-4 w-4" />
                  )}
                </div>

                {isExpanded && (
                  <div className="pl-6 py-1 space-y-1">
                    {spaces.map((space) => {
                      const isCurrentSpace =
                        current.organization?.id === org.id &&
                        current.space?.id === space.id &&
                        current.type === 'space';

                      return (
                        <DropdownMenuItem
                          key={space.id}
                          onClick={() => tenant.setSpace(space.id)}
                          className={cn('cursor-pointer', isCurrentSpace && 'bg-accent text-accent-foreground')}
                        >
                          <span className="flex-1 truncate">{space.name}</span>
                          {isCurrentSpace && <Icon icon="lucide:check" className="h-4 w-4 ml-2" />}
                        </DropdownMenuItem>
                      );
                    })}

                    <DropdownMenuItem
                      onClick={() => tenant.setOrganization(org.id)}
                      className="cursor-pointer border-t"
                    >
                      <Icon icon="lucide:settings" className="h-4 w-4 mr-2" />
                      <span>Manage</span>
                    </DropdownMenuItem>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={tenant.setUser}
          className={cn('cursor-pointer', current.type === 'user' && 'bg-accent text-accent-foreground')}
        >
          <Icon icon="lucide:user" className="h-4 w-4 mr-2" />
          <span className="flex-1">Personal</span>
          {current.type === 'user' && <Icon icon="lucide:check" className="h-4 w-4 ml-2" />}
        </DropdownMenuItem>

        {onManageOrganizations && (
          <DropdownMenuItem onClick={onManageOrganizations} className="cursor-pointer">
            <Icon icon="lucide:boxes" className="h-4 w-4 mr-2" />
            <span>Your Organizations</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

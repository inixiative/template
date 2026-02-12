import { useState } from 'react';
import { useAppStore } from '@template/ui/store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@template/ui/components/DropdownMenu';
import { cn } from '@template/ui/lib/utils';
import { Boxes, Building2, Check, ChevronDown, ChevronsUpDown, ChevronUp, Settings, User } from 'lucide-react';

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

export const ContextSelector = ({
  onManageOrganizations,
  locked = false,
  className,
}: ContextSelectorProps) => {
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
      ? current.organization?.name ?? 'Organization'
      : current.type === 'space'
        ? current.space?.name ?? 'Space'
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
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[280px]" align="start">
        <div className="max-h-[60vh] overflow-y-auto">
          {organizations.map((org) => {
            const isCurrentOrg = current.organization?.id === org.id && current.type === 'organization';
            const isExpanded = expandedOrgId === org.id;
            const spaces = org.spaces || [];

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
                  <Building2 className="h-4 w-4 mr-2" />
                  <span className="flex-1 truncate">{space.name}</span>
                  {isCurrentSpace && <Check className="h-4 w-4 ml-2" />}
                </DropdownMenuItem>
              );
            }

            return (
              <div key={org.id}>
                <DropdownMenuItem onClick={() => toggleOrg(org.id)} className="cursor-pointer">
                  <Building2 className="h-4 w-4 mr-2" />
                  <span className="flex-1 truncate">
                    {org.name} ({spaces.length})
                  </span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </DropdownMenuItem>

                {isExpanded && (
                  <div className="pl-6 py-1 space-y-1">
                    {spaces.map((space) => {
                      const isCurrentSpace =
                        current.organization?.id === org.id && current.space?.id === space.id && current.type === 'space';

                      return (
                        <DropdownMenuItem
                          key={space.id}
                          onClick={() => tenant.setSpace(space.id)}
                          className={cn('cursor-pointer', isCurrentSpace && 'bg-accent text-accent-foreground')}
                        >
                          <span className="flex-1 truncate">{space.name}</span>
                          {isCurrentSpace && <Check className="h-4 w-4 ml-2" />}
                        </DropdownMenuItem>
                      );
                    })}

                    <DropdownMenuItem
                      onClick={() => tenant.setOrganization(org.id)}
                      className="cursor-pointer border-t"
                    >
                      <Settings className="h-4 w-4 mr-2" />
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
          <User className="h-4 w-4 mr-2" />
          <span className="flex-1">Personal</span>
          {current.type === 'user' && <Check className="h-4 w-4 ml-2" />}
        </DropdownMenuItem>

        {onManageOrganizations && (
          <DropdownMenuItem onClick={onManageOrganizations} className="cursor-pointer">
            <Boxes className="h-4 w-4 mr-2" />
            <span>Your Organizations</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

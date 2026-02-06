import { useState } from 'react';
import { cn } from '@ui/lib/utils';
import { Header } from './Header';
import { Sidebar, type SidebarSection, type NavContext } from './Sidebar';
import { ContextSelector, type CurrentContext, type OrganizationOption } from './ContextSelector';
import { UserMenu, type UserMenuUser } from './UserMenu';
import { HelpCircle } from 'lucide-react';

export type AppShellProps = {
  logo?: React.ReactNode;
  currentContext?: CurrentContext;
  organizations?: OrganizationOption[];
  lockedContext?: boolean;
  navSections?: SidebarSection[];
  navContext?: NavContext;
  currentPath?: string;
  permissions?: any;
  user: UserMenuUser;
  isSuperadmin?: boolean;
  isSpoofing?: boolean;
  onSelectPersonal?: () => void;
  onSelectOrganization?: (organizationId: string) => void;
  onSelectSpace?: (organizationId: string, spaceId: string) => void;
  onManageOrganizations?: () => void;
  onNavigate?: (path: string) => void;
  onProfile?: () => void;
  onSettings?: () => void;
  onSpoof?: () => void;
  onUnspoof?: () => void;
  onLogout: () => void;
  onSupport?: () => void;
  children: React.ReactNode;
};

export const AppShell = ({
  logo,
  currentContext,
  organizations,
  lockedContext = false,
  navSections,
  navContext,
  currentPath,
  permissions,
  user,
  isSuperadmin,
  isSpoofing,
  onSelectPersonal,
  onSelectOrganization,
  onSelectSpace,
  onManageOrganizations,
  onNavigate,
  onProfile,
  onSettings,
  onSpoof,
  onUnspoof,
  onLogout,
  onSupport,
  children,
}: AppShellProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r bg-background transition-transform lg:relative lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col h-full">
          {currentContext && organizations && onSelectPersonal && onSelectOrganization && onSelectSpace && (
            <div className="p-4 border-b">
              <ContextSelector
                current={currentContext}
                organizations={organizations}
                onSelectPersonal={onSelectPersonal}
                onSelectOrganization={onSelectOrganization}
                onSelectSpace={onSelectSpace}
                onManageOrganizations={onManageOrganizations}
                locked={lockedContext}
              />
            </div>
          )}
          {navSections && currentPath !== undefined && permissions && navContext && onNavigate && (
            <div className="flex-1 overflow-y-auto">
              <Sidebar
                sections={navSections}
                currentPath={currentPath}
                permissions={permissions}
                context={navContext}
                onNavigate={(path) => {
                  onNavigate(path);
                  setIsMobileMenuOpen(false);
                }}
              />
            </div>
          )}
          {!navSections && <div className="flex-1" />}
          <div className="border-t">
            {onSupport && (
              <button
                onClick={onSupport}
                className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-sm"
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>Support</span>
              </button>
            )}
            <div className="p-2">
              <UserMenu
                user={user}
                isSuperadmin={isSuperadmin}
                isSpoofing={isSpoofing}
                onProfile={onProfile}
                onSettings={onSettings}
                onSpoof={onSpoof}
                onUnspoof={onUnspoof}
                onLogout={onLogout}
              />
            </div>
          </div>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header logo={logo} onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

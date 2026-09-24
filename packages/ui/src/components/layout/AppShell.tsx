/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { ContextSelector } from '@template/ui/components/layout/ContextSelector';
import { Header } from '@template/ui/components/layout/Header';
import { Sidebar } from '@template/ui/components/layout/Sidebar';
import { UserMenu } from '@template/ui/components/layout/UserMenu';
import { cn } from '@template/ui/lib/utils';
import { useAppStore } from '@template/ui/store';
import { useState } from 'react';

export type AppShellProps = {
  onSupport?: () => void;
  lockedContext?: boolean;
  showSpoofControls?: boolean;
  brand?: React.ReactNode;
  children: React.ReactNode;
};

export const AppShell = ({
  onSupport,
  lockedContext = false,
  showSpoofControls = true,
  brand,
  children,
}: AppShellProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const shortName = useAppStore((state) => state.ui.shortName);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r bg-background transition-transform lg:relative lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex flex-col gap-3 border-b p-4">
            <div className="flex h-8 items-center px-2 text-lg font-bold tracking-tight">{brand ?? shortName}</div>
            <ContextSelector locked={lockedContext} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <Sidebar />
          </div>
          <div className="border-t">
            {onSupport && (
              <button
                type="button"
                onClick={onSupport}
                className="w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-sm"
              >
                <Icon icon="lucide:help-circle" className="h-4 w-4 shrink-0" />
                <span>Support</span>
              </button>
            )}
            <div className="p-2">
              <UserMenu showSpoofControls={showSpoofControls} />
            </div>
          </div>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} brand={brand ?? shortName} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};

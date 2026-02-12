import { useAppStore } from '@template/ui/store';
import { ContextSelector } from '@template/ui/components/layout/ContextSelector';
import { Header } from '@template/ui/components/layout/Header';
import { Sidebar } from '@template/ui/components/layout/Sidebar';
import { UserMenu } from '@template/ui/components/layout/UserMenu';
import { cn } from '@template/ui/lib/utils';
import { HelpCircle } from 'lucide-react';
import { useState } from 'react';

export type AppShellProps = {
  onSupport?: () => void;
  lockedContext?: boolean;
  children: React.ReactNode;
};

export const AppShell = ({
  onSupport,
  lockedContext = false,
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
          <div className="p-4 border-b">
            <ContextSelector locked={lockedContext} />
          </div>
          <div className="flex-1 overflow-y-auto">
            <Sidebar />
          </div>
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
              <UserMenu />
            </div>
          </div>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
};

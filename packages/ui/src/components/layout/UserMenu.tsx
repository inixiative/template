import { useState } from 'react';
import { useAppStore } from '@template/ui/store';
import { Avatar, AvatarFallback, AvatarImage } from '@template/ui/components/Avatar';
import { Button } from '@template/ui/components/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@template/ui/components/DropdownMenu';
import { Input } from '@template/ui/components/Input';
import { cn } from '@template/ui/lib/utils';
import { LogOut, Settings, ShieldAlert, User } from 'lucide-react';

export type UserMenuProps = {
  className?: string;
};

export const UserMenu = ({ className }: UserMenuProps) => {
  const [spoofEmail, setSpoofEmail] = useState('');

  // Read all state from Zustand store
  const user = useAppStore((state) => state.auth.user);
  const isSuperadmin = useAppStore((state) => state.permissions.permix.isSuperadmin());
  const isSpoofing = useAppStore((state) => state.auth.spoofUserEmail !== null);
  const spoofUserEmail = useAppStore((state) => state.auth.spoofUserEmail);
  const setSpoof = useAppStore((state) => state.auth.setSpoof);
  const logout = useAppStore((state) => state.auth.logout);
  const navigatePreservingSpoof = useAppStore((state) => state.navigation.navigatePreservingSpoof);

  const handleSpoofSubmit = async () => {
    if (spoofEmail.trim()) {
      await setSpoof(spoofEmail.trim());
      setSpoofEmail('');
    }
  };

  const handleExitSpoof = async () => {
    await setSpoof(null);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn('w-full', className)}>
        <div
          className={cn(
            'flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors',
            isSpoofing && 'bg-destructive/10 border border-destructive/20',
          )}
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? 'User'} />
            <AvatarFallback className="rounded-lg">{user?.name?.charAt(0).toUpperCase() ?? 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-semibold truncate">{user?.name ?? 'User'}</div>
            <div
              className={cn('text-xs truncate', isSpoofing ? 'text-destructive font-medium' : 'text-muted-foreground')}
            >
              {isSpoofing ? 'Spoofing' : user?.email ?? ''}
            </div>
          </div>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem onClick={() => navigatePreservingSpoof('/settings')}>
          <Settings className="h-4 w-4 mr-2" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {(isSuperadmin || isSpoofing) && (
          <>
            <DropdownMenuLabel>Spoof User</DropdownMenuLabel>
            <div className="px-2 py-2 space-y-2">
              <Input
                type="email"
                placeholder={spoofUserEmail || 'user@example.com'}
                value={spoofEmail}
                onChange={(e) => setSpoofEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSpoofSubmit();
                }}
                className="h-8"
              />
              <div className="flex gap-2">
                <Button onClick={handleSpoofSubmit} size="sm" className="flex-1">
                  Spoof
                </Button>
                {isSpoofing && (
                  <Button onClick={handleExitSpoof} size="sm" variant="outline" className="flex-1">
                    Exit
                  </Button>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

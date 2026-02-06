import { User, Settings, LogOut, UserCog, ShieldAlert } from 'lucide-react';
import { cn } from '@ui/lib/utils';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../DropdownMenu';
import { Avatar, AvatarImage, AvatarFallback } from '../Avatar';

export type UserMenuUser = {
  name: string;
  email: string;
  avatarUrl?: string;
};

export type UserMenuProps = {
  user: UserMenuUser;
  isSuperadmin?: boolean;
  isSpoofing?: boolean;
  onProfile?: () => void;
  onSettings?: () => void;
  onSpoof?: () => void;
  onUnspoof?: () => void;
  onLogout: () => void;
  className?: string;
};

export const UserMenu = ({
  user,
  isSuperadmin,
  isSpoofing,
  onProfile,
  onSettings,
  onSpoof,
  onUnspoof,
  onLogout,
  className
}: UserMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn('w-full', className)}>
        <div className={cn(
          'flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors',
          isSpoofing && 'bg-destructive/10 border border-destructive/20'
        )}>
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback className="rounded-lg">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className={cn(
              'text-xs truncate',
              isSpoofing ? 'text-destructive font-medium' : 'text-muted-foreground'
            )}>
              {isSpoofing ? 'Spoofing' : user.email}
            </div>
          </div>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="start">
        {isSpoofing && onUnspoof && (
          <>
            <DropdownMenuItem onClick={onUnspoof} className="text-destructive">
              <ShieldAlert className="h-4 w-4 mr-2" />
              <span>Exit Spoof Mode</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {onProfile && (
          <DropdownMenuItem onClick={onProfile}>
            <User className="h-4 w-4 mr-2" />
            <span>Profile</span>
          </DropdownMenuItem>
        )}
        {onSettings && (
          <DropdownMenuItem onClick={onSettings}>
            <Settings className="h-4 w-4 mr-2" />
            <span>Settings</span>
          </DropdownMenuItem>
        )}
        {isSuperadmin && onSpoof && !isSpoofing && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSpoof}>
              <UserCog className="h-4 w-4 mr-2" />
              <span>Spoof User</span>
            </DropdownMenuItem>
          </>
        )}
        {(onProfile || onSettings || (isSuperadmin && onSpoof && !isSpoofing)) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

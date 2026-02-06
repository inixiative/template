import { X } from 'lucide-react';
import { cn } from '@ui/lib/utils';

export type DrawerOverlayProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

export const DrawerOverlay = ({ open, onClose, children, className }: DrawerOverlayProps) => {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 w-96 bg-background border-l z-50 overflow-y-auto',
          'transform transition-transform',
          className,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-background">
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </>
  );
};

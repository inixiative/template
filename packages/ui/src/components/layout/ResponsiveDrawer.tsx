import { X } from 'lucide-react';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Modal } from './Modal';
import { cn } from '../../lib/utils';

export type ResponsiveDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
};

export const ResponsiveDrawer = ({
  open,
  onClose,
  title,
  children,
  className,
  breakpoint = 'md',
}: ResponsiveDrawerProps) => {
  const isDesktop = useBreakpoint(breakpoint);

  if (!open) return null;

  if (isDesktop) {
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
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            <button
              onClick={onClose}
              className={cn('p-2 hover:bg-accent rounded-md transition-colors', !title && 'ml-auto')}
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
  }

  return (
    <Modal open={open} onClose={onClose} title={title} className={className}>
      {children}
    </Modal>
  );
};

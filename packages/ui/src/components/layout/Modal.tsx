import { X } from 'lucide-react';
import { cn } from '@ui/lib/utils';

export type ModalSize = 'small' | 'large';

export type ModalProps = {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  size?: ModalSize;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export const Modal = ({ open, isOpen, onClose, size = 'small', title, children, className }: ModalProps) => {
  const isModalOpen = open ?? isOpen ?? false;

  if (!isModalOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className={cn(
            'bg-background rounded-lg shadow-lg max-h-[90vh] overflow-hidden flex flex-col',
            size === 'small' && 'w-full max-w-md',
            size === 'large' && 'w-full max-w-3xl',
            className,
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onClose();
            }
          }}
        >
          <div className="flex items-center justify-between p-4 border-b">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            <button
              onClick={onClose}
              className={cn("p-2 hover:bg-accent rounded-md transition-colors", !title && "ml-auto")}
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

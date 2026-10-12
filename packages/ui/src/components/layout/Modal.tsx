/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { cn } from '@template/ui/lib/utils';
import { useAppStore } from '@template/ui/store';

export type ModalSize = 'small' | 'large';

export type ModalProps = {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  dismissOnBackdrop?: boolean;
  size?: ModalSize;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export const Modal = ({
  open,
  isOpen,
  onClose,
  dismissOnBackdrop = true,
  size = 'small',
  title,
  children,
  className,
}: ModalProps) => {
  const isModalOpen = open ?? isOpen ?? false;
  const flowContinue = useAppStore((state) => state.navigation.flowContinue);
  const continueLabel = flowContinue?.label ?? null;
  const close = () => {
    onClose();
    if (flowContinue) useAppStore.getState().navigation.continueFlow();
  };

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-black/50"
        onClick={dismissOnBackdrop ? close : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative bg-background rounded-lg shadow-lg max-h-[90vh] overflow-hidden flex flex-col',
          size === 'small' && 'w-full max-w-md',
          size === 'large' && 'w-full max-w-3xl',
          className,
        )}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            close();
          }
        }}
      >
        <div className="flex items-center justify-between p-4 border-b">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          <button
            type="button"
            onClick={close}
            className={cn(
              'p-2 hover:bg-accent rounded-md transition-colors',
              continueLabel && 'text-sm font-medium',
              !title && 'ml-auto',
            )}
            aria-label={continueLabel ?? 'Close modal'}
          >
            {continueLabel ?? <Icon icon="lucide:x" className="h-5 w-5" />}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

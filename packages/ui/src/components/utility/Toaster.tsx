import { Toaster as SonnerToaster } from 'sonner';

/**
 * Global toast notification system
 *
 * Place once at app root. Use the `toast` utility from this package for notifications.
 *
 * Uses app-level CSS color variables (--error, --success, --warning, --info)
 */
export const Toaster = () => {
  return (
    <SonnerToaster
      position="top-right"
      closeButton
      richColors
    />
  );
};

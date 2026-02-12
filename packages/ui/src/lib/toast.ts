import { toast as sonnerToast } from 'sonner';

/**
 * Toast notification utility with automatic duration settings
 *
 * Durations:
 * - success: 3000ms (auto-dismiss)
 * - error: Infinity (persist until closed)
 * - warning: 6000ms (double time)
 * - info: 3000ms (auto-dismiss)
 *
 * @example
 * ```tsx
 * import { toast } from '@template/ui/lib/toast';
 *
 * toast.success('Organization created');
 * toast.error('Failed to save changes');
 * toast.warning('Session expiring soon');
 * ```
 */
export const toast = {
  success: (message: string, options?: Parameters<typeof sonnerToast.success>[1]) => {
    return sonnerToast.success(message, { duration: 3000, ...options });
  },

  error: (message: string, options?: Parameters<typeof sonnerToast.error>[1]) => {
    return sonnerToast.error(message, { duration: Infinity, ...options });
  },

  warning: (message: string, options?: Parameters<typeof sonnerToast.warning>[1]) => {
    return sonnerToast.warning(message, { duration: 6000, ...options });
  },

  info: (message: string, options?: Parameters<typeof sonnerToast.info>[1]) => {
    return sonnerToast.info(message, { duration: 3000, ...options });
  },

  // Generic toast (uses default duration)
  message: (message: string, options?: Parameters<typeof sonnerToast>[1]) => {
    return sonnerToast(message, { duration: 3000, ...options });
  },

  // Promise-based toast for async operations
  promise: sonnerToast.promise,

  // Dismiss specific or all toasts
  dismiss: sonnerToast.dismiss,
};

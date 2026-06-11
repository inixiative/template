/**
 * @atlas
 * @partOf primitive:ui
 */
import { toast as sonnerToast } from 'sonner';

type ToastPromiseInput<TData> = Promise<TData> | (() => Promise<TData>);
type ToastPromiseOptions<TData> = {
  loading?: string;
  success?: string | ((data: TData) => string);
  error?: string | ((error: unknown) => string);
  description?: string | ((data: TData) => string);
  finally?: () => void | Promise<void>;
};
type ToastPromiseResult<TData> = { unwrap: () => Promise<TData> };

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
  promise: <TData>(
    promise: ToastPromiseInput<TData>,
    options?: ToastPromiseOptions<TData>,
  ): ToastPromiseResult<TData> => {
    return sonnerToast.promise(promise, options);
  },

  // Dismiss specific or all toasts
  dismiss: sonnerToast.dismiss,
};

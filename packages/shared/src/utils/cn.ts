import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 * Standard shadcn/ui utility function
 */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

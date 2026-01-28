/**
 * Normalize email for consistent storage and lookup.
 */
export const normalizeEmail = (email: string): string => email.toLowerCase().trim();

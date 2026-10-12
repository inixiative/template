/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import { z } from 'zod';

const APP_ORIGIN = 'https://app.invalid';

export const isAppPath = (value: string): boolean => {
  if (!value.startsWith('/')) return false;
  try {
    const url = new URL(value, APP_ORIGIN);
    return url.origin === APP_ORIGIN && !url.pathname.startsWith('//');
  } catch {
    return false;
  }
};

export const appPathSchema = z
  .string()
  .max(2048)
  .refine(isAppPath, { message: 'Must be a path inside this app, starting with a single /' });

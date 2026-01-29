import type { AuthStrategy } from './types';

export const isEmbedded = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const detectAuthStrategy = (options?: {
  loginUrl?: string;
  parentOrigin?: string;
}): AuthStrategy => {
  if (isEmbedded()) {
    return { type: 'embed', parentOrigin: options?.parentOrigin };
  }
  if (options?.loginUrl) {
    return { type: 'redirect', loginUrl: options.loginUrl };
  }
  return { type: 'otp' };
};

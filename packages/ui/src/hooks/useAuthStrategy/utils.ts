import type { AuthStrategy } from '@template/ui/hooks/useAuthStrategy/types';

export const isEmbedded = (): boolean => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const detectAuthStrategy = (options?: { parentOrigin?: string }): AuthStrategy => {
  if (isEmbedded()) {
    return { type: 'embed', parentOrigin: options?.parentOrigin };
  }
  return { type: 'login' };
};

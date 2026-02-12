import type {
  AuthStrategy,
  AuthStrategyContextType,
  EmbedAuthCompleteMessage,
  EmbedAuthRequiredMessage,
  EmbedMessage,
  PendingAuthCallback,
} from '@template/ui/hooks/useAuthStrategy/types';
import { createContext, type ReactNode, useCallback, useEffect, useRef } from 'react';

export const AuthStrategyContext = createContext<AuthStrategyContextType | null>(null);

type AuthStrategyProviderProps = {
  strategy: AuthStrategy;
  children: ReactNode;
  isAuthenticated: boolean;
  onTokenReceived?: (token: string) => Promise<void> | void;
};

export const AuthStrategyProvider = ({
  strategy,
  children,
  isAuthenticated,
  onTokenReceived,
}: AuthStrategyProviderProps) => {
  const pendingCallbackRef = useRef<PendingAuthCallback | null>(null);

  // Embed: Listen for token from parent
  useEffect(() => {
    if (strategy.type !== 'embed') return;

    const handleMessage = async (event: MessageEvent<EmbedMessage>) => {
      if (strategy.parentOrigin && event.origin !== strategy.parentOrigin) return;
      if (event.data?.type !== 'embed:auth_token') return;

      const { token: receivedToken } = event.data;

      try {
        if (onTokenReceived) await onTokenReceived(receivedToken);

        window.parent.postMessage(
          { type: 'embed:auth_complete', success: true } satisfies EmbedAuthCompleteMessage,
          strategy.parentOrigin ?? '*',
        );

        pendingCallbackRef.current?.();
        pendingCallbackRef.current = null;
      } catch {
        window.parent.postMessage(
          { type: 'embed:auth_complete', success: false } satisfies EmbedAuthCompleteMessage,
          strategy.parentOrigin ?? '*',
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [strategy, onTokenReceived]);

  // Embed: Check for token in URL on mount
  useEffect(() => {
    if (strategy.type !== 'embed') return;

    const url = new URL(window.location.href);
    const urlToken = url.searchParams.get('token') || url.hash.match(/token=([^&]+)/)?.[1];

    if (urlToken) {
      url.searchParams.delete('token');
      url.hash = url.hash.replace(/token=[^&]+&?/, '');
      window.history.replaceState({}, '', url.toString());
      if (onTokenReceived) onTokenReceived(urlToken);
    }
  }, [strategy, onTokenReceived]);

  const requireAuth = useCallback(
    (onSuccess?: PendingAuthCallback) => {
      if (isAuthenticated) {
        onSuccess?.();
        return;
      }

      switch (strategy.type) {
        case 'login': {
          const redirectTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          window.location.assign(`/login?redirectTo=${encodeURIComponent(redirectTo || '/')}`);
          break;
        }
        case 'embed': {
          pendingCallbackRef.current = onSuccess ?? null;
          window.parent.postMessage(
            { type: 'embed:auth_required' } satisfies EmbedAuthRequiredMessage,
            strategy.parentOrigin ?? '*',
          );
          break;
        }
      }
    },
    [strategy, isAuthenticated],
  );

  const setEmbedToken = useCallback(
    async (receivedToken: string) => {
      if (onTokenReceived) await onTokenReceived(receivedToken);
      pendingCallbackRef.current?.();
      pendingCallbackRef.current = null;
    },
    [onTokenReceived],
  );

  return (
    <AuthStrategyContext.Provider
      value={{
        strategy,
        isAuthenticated,
        requireAuth,
        setEmbedToken,
      }}
    >
      {children}
    </AuthStrategyContext.Provider>
  );
};

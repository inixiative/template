import { createContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type {
  AuthStrategy,
  AuthStrategyContextType,
  PendingAuthCallback,
  EmbedMessage,
  EmbedAuthCompleteMessage,
  EmbedAuthRequiredMessage,
} from './types';

export const AuthStrategyContext = createContext<AuthStrategyContextType | null>(null);

type AuthStrategyProviderProps = {
  strategy: AuthStrategy;
  children: ReactNode;
  isAuthenticated: boolean;
  onTokenReceived?: (token: string) => Promise<void> | void;
};

const POST_AUTH_CALLBACK_KEY = 'auth_strategy_callback';

export const AuthStrategyProvider = ({
  strategy,
  children,
  isAuthenticated,
  onTokenReceived,
}: AuthStrategyProviderProps) => {
  const [showOtpModal, setShowOtpModal] = useState(false);
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
          strategy.parentOrigin ?? '*'
        );

        pendingCallbackRef.current?.();
        pendingCallbackRef.current = null;
      } catch {
        window.parent.postMessage(
          { type: 'embed:auth_complete', success: false } satisfies EmbedAuthCompleteMessage,
          strategy.parentOrigin ?? '*'
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

  // Redirect: Check for pending callback on mount
  useEffect(() => {
    if (strategy.type !== 'redirect' || !isAuthenticated) return;

    const pendingCallback = sessionStorage.getItem(POST_AUTH_CALLBACK_KEY);
    if (pendingCallback) sessionStorage.removeItem(POST_AUTH_CALLBACK_KEY);
  }, [strategy, isAuthenticated]);

  const requireAuth = useCallback(
    (onSuccess?: PendingAuthCallback) => {
      if (isAuthenticated) {
        onSuccess?.();
        return;
      }

      switch (strategy.type) {
        case 'redirect': {
          if (onSuccess) sessionStorage.setItem(POST_AUTH_CALLBACK_KEY, 'pending');
          const returnUrl = encodeURIComponent(window.location.href);
          window.location.href = `${strategy.loginUrl}?returnUrl=${returnUrl}`;
          break;
        }
        case 'otp': {
          pendingCallbackRef.current = onSuccess ?? null;
          setShowOtpModal(true);
          break;
        }
        case 'embed': {
          pendingCallbackRef.current = onSuccess ?? null;
          window.parent.postMessage(
            { type: 'embed:auth_required' } satisfies EmbedAuthRequiredMessage,
            strategy.parentOrigin ?? '*'
          );
          break;
        }
      }
    },
    [strategy, isAuthenticated]
  );

  const setEmbedToken = useCallback(
    async (receivedToken: string) => {
      if (onTokenReceived) await onTokenReceived(receivedToken);
      pendingCallbackRef.current?.();
      pendingCallbackRef.current = null;
    },
    [onTokenReceived]
  );

  const closeOtpModal = useCallback(() => {
    setShowOtpModal(false);
    pendingCallbackRef.current = null;
  }, []);

  const completeOtpAuth = useCallback(
    async (receivedToken: string) => {
      if (onTokenReceived) await onTokenReceived(receivedToken);
      setShowOtpModal(false);
      pendingCallbackRef.current?.();
      pendingCallbackRef.current = null;
    },
    [onTokenReceived]
  );

  return (
    <AuthStrategyContext.Provider
      value={{
        strategy,
        isAuthenticated,
        requireAuth,
        setEmbedToken,
        showOtpModal,
        closeOtpModal,
        completeOtpAuth,
      }}
    >
      {children}
    </AuthStrategyContext.Provider>
  );
};

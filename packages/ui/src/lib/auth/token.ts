// TODO: Add refresh token support (AUTH-002)
// - Store refresh token in localStorage
// - Auto-refresh access token when expired
// - Handle refresh token rotation

const TOKEN_KEY = 'auth_token';
const EXPIRY_KEY = 'auth_token_expiry';

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!token || !expiry) return null;
  if (new Date(expiry) <= new Date()) {
    clearToken();
    return null;
  }
  return token;
};

export const setToken = (token: string, expiresAt: Date): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRY_KEY, expiresAt.toISOString());
};

export const clearToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
};

export const isTokenValid = (): boolean => {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!token || !expiry) return false;
  return new Date(expiry) > new Date();
};

export const getTokenExpiry = (): Date | null => {
  if (typeof window === 'undefined') return null;
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!expiry) return null;
  return new Date(expiry);
};

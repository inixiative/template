export { fetchAndHydrateMe } from '@template/ui/lib/auth/fetchAndHydrateMe';
export { signIn } from '@template/ui/lib/auth/signIn';
export { signUp } from '@template/ui/lib/auth/signUp';
export {
  clearToken,
  fetchStoredTokenAndClearIfExpired,
  isTokenValid,
  setToken,
  storedTokenExpiry,
} from '@template/ui/lib/auth/token';
export * from '@template/ui/lib/auth/types';

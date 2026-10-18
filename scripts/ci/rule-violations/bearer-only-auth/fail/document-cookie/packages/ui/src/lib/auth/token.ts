export const getToken = () =>
  document.cookie.split('; ').find((part) => part.startsWith('session_token='))?.split('=')[1];

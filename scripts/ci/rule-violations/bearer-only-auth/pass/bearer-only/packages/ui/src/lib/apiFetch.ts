export const apiFetch = (url: string, token: string) =>
  fetch(url, { credentials: 'omit', headers: { Authorization: `Bearer ${token}` } });

export const request = (url: string, browser: boolean) =>
  fetch(url, { credentials: browser ? 'include' : 'omit' });

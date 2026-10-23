const response = await fetch('/api/v1/me', { credentials: 'include' });
const session = await auth.api.getSession({ headers: response.headers });

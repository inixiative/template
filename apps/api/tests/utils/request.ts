// Test request helpers

export function createRequest(
  method: string,
  path: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  },
) {
  const url = `http://localhost${path}`;
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  };

  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }

  return new Request(url, init);
}

export function get(path: string, headers?: Record<string, string>) {
  return createRequest('GET', path, { headers });
}

export function post(path: string, body?: unknown, headers?: Record<string, string>) {
  return createRequest('POST', path, { body, headers });
}

export function patch(path: string, body?: unknown, headers?: Record<string, string>) {
  return createRequest('PATCH', path, { body, headers });
}

export function del(path: string, headers?: Record<string, string>) {
  return createRequest('DELETE', path, { headers });
}

const API_URL = 'http://localhost:3000';

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export async function api<T>(path: string, options?: ApiOptions): Promise<T> {
  const { method = 'GET', body, token } = options || {};

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
}

// Auth API
export type AuthResponse = {
  data: {
    token: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      emailVerified: boolean;
    };
  };
};

export type UserResponse = {
  data: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    kycStatus: string;
    createdAt: string;
  };
};

export const authApi = {
  signup: (email: string, password: string, name?: string) =>
    api<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: { email, password, name },
    }),

  login: (email: string, password: string) =>
    api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  me: (token: string) =>
    api<UserResponse>('/auth/me', { token }),
};

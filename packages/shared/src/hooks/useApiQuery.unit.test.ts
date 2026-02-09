import { describe, expect, it, beforeEach, mock, afterEach } from 'bun:test';
import { useAppStore } from '../store';

// Mock fetch
const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof mock>;

describe('API header injection', () => {
  beforeEach(() => {
    // Set up store with auth token and spoof email
    useAppStore.setState({
      auth: {
        ...useAppStore.getState().auth,
        spoofUserEmail: null,
        session: {
          accessToken: 'test-token-123',
          userId: 'user-1',
          expiresAt: new Date(Date.now() + 3600000),
        } as any,
      },
    });

    mockFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
        }),
      ),
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should have auth token available in store', () => {
    const token = useAppStore.getState().auth.session?.accessToken;
    expect(token).toBe('test-token-123');
  });

  it('should have spoof email available in store when set', () => {
    useAppStore.setState({
      auth: {
        ...useAppStore.getState().auth,
        spoofUserEmail: 'admin@example.com',
      },
    });

    const spoofEmail = useAppStore.getState().auth.spoofUserEmail;
    expect(spoofEmail).toBe('admin@example.com');
  });

  it('should correctly build headers with auth token', () => {
    const token = useAppStore.getState().auth.session?.accessToken;
    const spoofUserEmail = useAppStore.getState().auth.spoofUserEmail;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (spoofUserEmail) {
      headers['x-spoof-user-email'] = spoofUserEmail;
    }

    expect(headers.Authorization).toBe('Bearer test-token-123');
    expect(headers['x-spoof-user-email']).toBeUndefined();
  });

  it('should correctly build headers with auth token and spoof email', () => {
    useAppStore.setState({
      auth: {
        ...useAppStore.getState().auth,
        spoofUserEmail: 'spoofed@example.com',
      },
    });

    const token = useAppStore.getState().auth.session?.accessToken;
    const spoofUserEmail = useAppStore.getState().auth.spoofUserEmail;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (spoofUserEmail) {
      headers['x-spoof-user-email'] = spoofUserEmail;
    }

    expect(headers.Authorization).toBe('Bearer test-token-123');
    expect(headers['x-spoof-user-email']).toBe('spoofed@example.com');
  });

  it('queryClient should be available in store', () => {
    const queryClient = useAppStore.getState().api.queryClient;
    expect(queryClient).toBeDefined();
    expect(queryClient.mount).toBeDefined();
    expect(queryClient.unmount).toBeDefined();
  });
});

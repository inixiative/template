import { auth } from '#/lib/auth';

export type WSAuthResult = {
  connectionId: string;
  userId: string | null;
};

/**
 * Authenticate WebSocket upgrade request.
 * Uses bearer token passed as query param (WS can't set headers from browser).
 *
 * Client connects with: ws://host?token=<bearer_token>
 * Anonymous connections allowed (userId will be null).
 *
 * Returns unique connectionId for tracking (supports multiple tabs per user).
 */
export const authenticateWS = async (req: Request): Promise<WSAuthResult> => {
  const connectionId = crypto.randomUUID();

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return { connectionId, userId: null };
    }

    // Validate bearer token via better-auth
    const headers = new Headers({ authorization: `Bearer ${token}` });
    const session = await auth.api.getSession({ headers });

    return {
      connectionId,
      userId: session?.user?.id ?? null,
    };
  } catch {
    return { connectionId, userId: null };
  }
};

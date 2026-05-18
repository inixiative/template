// @wip — WS auth layer not finalized; part of the ws/ rewrite (see pubsub.ts / handler.ts).
// Known TODOs: the try/catch swallows token validation failures silently and returns
// `userId: null` (downgrades to anonymous). Decide whether that's right behavior vs. rejecting.

import { auth } from '#/lib/auth';

export type WSAuthResult = {
  connectionId: string;
  userId: string | null;
};

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

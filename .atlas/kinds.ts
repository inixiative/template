import { DEFAULT_KINDS } from '@inixiative/atlas';

// atlas's defaults already cover this codebase's roles; extend here as needed.
// 'channel' = an appEvents delivery channel (email/websocket/observe). Supersedes the default
// 'bridge' kind for these — 'bridge' collides with lens vocabulary (bridge keys on narrowings).
export const KINDS = [...DEFAULT_KINDS, 'channel'] as const;

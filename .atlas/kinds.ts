import { DEFAULT_KINDS } from '@inixiative/atlas';

// atlas's defaults already cover this codebase's roles; extend here as needed.
export const KINDS = [...DEFAULT_KINDS] as const;

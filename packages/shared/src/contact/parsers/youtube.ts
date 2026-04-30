import { splitUrl } from '@template/shared/contact/parsers/url';

export type YoutubeValue = { handle: string };

// YouTube: prefer @<handle> (canonical), accept /c/<handle> and /user/<handle>.
// Channel IDs (UC...) require a separate API lookup to resolve to a handle.
export const parseYoutubeUrl = (url: string): YoutubeValue => {
  const parts = splitUrl(url);
  if (parts[0]?.toLowerCase() !== 'youtube.com' || !parts[1]) {
    throw new Error(`Unrecognized YouTube URL: ${url}`);
  }
  const seg = parts[1]!;
  if (seg.startsWith('@')) return { handle: seg.slice(1) };
  if ((seg === 'c' || seg === 'user') && parts[2]) return { handle: parts[2]! };
  if (seg === 'channel') {
    throw new Error('YouTube channel IDs are not supported; use the @handle URL');
  }
  return { handle: seg };
};

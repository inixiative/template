/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
const FORMAT_PIECES = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(?:''|[^'])+(?:'|$)|./g;

const DISPLAY_TOKEN_LENGTHS: Readonly<Record<string, readonly number[]>> = {
  y: [1, 2, 4],
  Q: [1, 2, 3, 4],
  M: [1, 2, 3, 4, 5],
  L: [1, 2, 3, 4, 5],
  d: [1, 2],
  E: [1, 2, 3, 4, 5, 6],
  a: [1, 2, 3, 4, 5],
  h: [1, 2],
  H: [1, 2],
  K: [1, 2],
  k: [1, 2],
  m: [1, 2],
  s: [1, 2],
  S: [1, 2, 3],
  X: [1, 2, 3, 4, 5],
  x: [1, 2, 3, 4, 5],
  O: [1, 2, 3, 4],
  z: [1, 2, 3, 4],
  P: [1, 2, 3, 4],
  p: [1, 2, 3, 4],
};

const ORDINAL_TOKEN_LETTERS: ReadonlySet<string> = new Set('yQMLdhHKkms');

const isClosedQuote = (piece: string): boolean =>
  piece === "''" || piece.slice(1).replaceAll("''", '').endsWith("'");

const isDisplayToken = (piece: string): boolean => {
  const letter = piece[0] ?? '';
  if (piece.length === 2 && piece[1] === 'o' && letter !== 'o') {
    return ORDINAL_TOKEN_LETTERS.has(letter);
  }
  return DISPLAY_TOKEN_LENGTHS[letter]?.includes(piece.length) ?? false;
};

export const isDatetimeFormat = (format: string): boolean => {
  if (!format) return false;
  for (const [piece] of format.matchAll(FORMAT_PIECES)) {
    if (piece.startsWith("'")) {
      if (!isClosedQuote(piece)) return false;
      continue;
    }
    if (/^[A-Za-z]/.test(piece) && !isDisplayToken(piece)) return false;
  }
  return true;
};

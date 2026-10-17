/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
export const findJsonEnd = (str: string, start: number): number => {
  let depth = 0;
  let inString = false;
  let inEscape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (inEscape) {
      inEscape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      inEscape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
};

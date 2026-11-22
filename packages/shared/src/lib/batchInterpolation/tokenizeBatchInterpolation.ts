/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared, primitive:batch
 * @uses none
 */

export type BatchInterpolationReference = {
  kind: 'reference';
  raw: string;
  round: number;
  request: number;
  fieldPath: string;
};

export type BatchInterpolationToken = { kind: 'text'; value: string } | BatchInterpolationReference;

const OPEN = '<<';
const CLOSE = '>>';
const REFERENCE_PATTERN = /^<<(\d+)\.(\d+)\.([a-zA-Z0-9_.]+)>>$/;

const startsWithBracket = (value: string, index: number) =>
  value.startsWith(OPEN, index) || value.startsWith(CLOSE, index);

export const tokenizeBatchInterpolation = (value: string): BatchInterpolationToken[] => {
  const tokens: BatchInterpolationToken[] = [];
  let text = '';
  let index = 0;

  const pushText = () => {
    if (text) tokens.push({ kind: 'text', value: text });
    text = '';
  };

  while (index < value.length) {
    if (value[index] === '\\') {
      let runEnd = index;
      while (value[runEnd] === '\\') runEnd++;
      const runLength = runEnd - index;
      if (!startsWithBracket(value, runEnd)) {
        text += value.slice(index, runEnd);
        index = runEnd;
        continue;
      }
      text += '\\'.repeat(Math.floor(runLength / 2));
      if (runLength % 2 === 1) {
        text += value.slice(runEnd, runEnd + 2);
        index = runEnd + 2;
      } else {
        index = runEnd;
      }
      continue;
    }

    if (value.startsWith(OPEN, index)) {
      if (value[index + OPEN.length] === '<') {
        text += '<';
        index++;
        continue;
      }
      const closeIndex = value.indexOf(CLOSE, index + OPEN.length);
      if (closeIndex === -1) throw new Error('Unbalanced interpolation brackets: unclosed <<');
      const inner = value.slice(index + OPEN.length, closeIndex);
      if (inner.includes(OPEN)) throw new Error('Nested interpolation is not allowed');
      const raw = `${OPEN}${inner}${CLOSE}`;
      const match = REFERENCE_PATTERN.exec(raw);
      if (!match) {
        throw new Error(
          `Malformed interpolation syntax: ${raw}. Expected format: <<roundIndex.requestIndex.field.path>>`,
        );
      }
      pushText();
      tokens.push({
        kind: 'reference',
        raw,
        round: Number.parseInt(match[1], 10),
        request: Number.parseInt(match[2], 10),
        fieldPath: match[3],
      });
      index = closeIndex + CLOSE.length;
      continue;
    }

    if (value.startsWith(CLOSE, index)) {
      throw new Error('Unbalanced interpolation brackets: closing >> without opening <<');
    }

    text += value[index];
    index++;
  }

  pushText();
  return tokens;
};

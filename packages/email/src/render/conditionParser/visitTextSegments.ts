/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import {
  type DatetimeToken,
  datetimeTokensIn,
} from '@template/email/render/conditionParser/datetimeTokenAt';

export type TextSegmentVisitor = {
  text: (slice: string) => void;
  datetime?: (token: DatetimeToken) => void;
};

export const visitTextSegments = (content: string, visitor: TextSegmentVisitor): void => {
  const tokens = datetimeTokensIn(content);
  if (tokens.length === 0) {
    visitor.text(content);
    return;
  }
  let cursor = 0;
  for (const token of tokens) {
    if (token.start > cursor) visitor.text(content.slice(cursor, token.start));
    visitor.datetime?.(token);
    cursor = token.end;
  }
  if (cursor < content.length) visitor.text(content.slice(cursor));
};

/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */

import { eachMarkerAt } from '@template/email/render/conditionParser/eachMarkerAt';
import { findEachBodyEnd } from '@template/email/render/conditionParser/findEachBodyEnd';
import { END_EACH } from '@template/email/render/conditionParser/grammar';
import type { EachBlock } from '@template/email/render/conditionParser/types';

export const parseEachBlock = (content: string, openIdx: number): EachBlock | null => {
  const marker = eachMarkerAt(content, openIdx);
  if (!marker) return null;

  const bodyEnd = findEachBodyEnd(content, marker.next);
  if (bodyEnd === -1) return null;

  return {
    path: marker.path,
    as: marker.as,
    asMissing: marker.asMissing,
    index: marker.index,
    filter: marker.filter,
    filterError: marker.filterError,
    attributeErrors: marker.attributeErrors,
    body: content.slice(marker.next, bodyEnd - END_EACH.length),
    end: bodyEnd,
  };
};

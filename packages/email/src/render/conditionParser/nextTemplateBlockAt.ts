/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import { datetimeTokenAt } from '@template/email/render/conditionParser/datetimeTokenAt';
import { DATETIME, EACH, IF } from '@template/email/render/conditionParser/grammar';

export type NextTemplateBlock = { kind: 'if' | 'each'; openIdx: number };

export const nextTemplateBlockAt = (content: string, start: number): NextTemplateBlock | null => {
  let cursor = start;
  while (cursor < content.length) {
    const ifIdx = content.indexOf(IF, cursor);
    const eachIdx = content.indexOf(EACH, cursor);
    const dtIdx = content.indexOf(DATETIME, cursor);
    if (ifIdx === -1 && eachIdx === -1) return null;

    const blockIdx = eachIdx === -1 || (ifIdx !== -1 && ifIdx < eachIdx) ? ifIdx : eachIdx;

    if (dtIdx !== -1 && dtIdx < blockIdx) {
      const token = datetimeTokenAt(content, dtIdx);
      cursor = token ? token.end : dtIdx + DATETIME.length;
      continue;
    }

    return { kind: blockIdx === eachIdx ? 'each' : 'if', openIdx: blockIdx };
  }
  return null;
};

/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
export const readBareWord = (content: string, i: number): { value: string; next: number } => {
  let next = i;
  while (next < content.length && !/\s/.test(content[next] ?? '') && content.slice(next, next + 2) !== '}}') next++;
  return { value: content.slice(i, next), next };
};

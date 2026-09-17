/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
export const skipWhitespace = (content: string, i: number): number => {
  let next = i;
  while (/\s/.test(content[next] ?? '')) next++;
  return next;
};

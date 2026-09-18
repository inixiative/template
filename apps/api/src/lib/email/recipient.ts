/**
 * @atlas
 * @kind type
 * @partOf feature:email
 * @uses none
 */
export type Recipient = Record<string, unknown> & { id: string; name: string; email: string };

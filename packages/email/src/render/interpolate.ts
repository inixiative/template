/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { type RuleErrorSink, type Scope, settle } from '@template/email/render/settle';

export enum Lens {
  sender = 'sender',
  recipient = 'recipient',
  data = 'data',
  system = 'system',
}

export type Variables = {
  sender?: Record<string, unknown>;
  recipient?: Record<string, unknown>;
  data?: Record<string, unknown>;
  system?: Record<string, unknown>;
};

export const toScope = (variables: Variables): Scope => ({
  sender: variables.sender,
  recipient: variables.recipient,
  data: variables.data,
  system: variables.system,
});

export const interpolate = (template: string, variables: Variables, onError?: RuleErrorSink): string =>
  settle(template, toScope(variables), { substitute: true }, onError);

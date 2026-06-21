/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import type { Sender } from '#/lib/email/sender';

export type ResolvedSender = {
  platformName: string;
  webUrl: string;
};

export const resolveSender = async (_sender: Sender): Promise<ResolvedSender> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  webUrl: process.env.WEB_URL ?? '',
});

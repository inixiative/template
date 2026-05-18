import { interpolate, type Variables } from '@template/email/render/interpolate';
import type { MessageContent } from '#/lib/messaging/providers';

export const interpolateContent = (content: MessageContent, variables: Variables): MessageContent => ({
  ...content,
  text: content.text ? interpolate(content.text, variables) : undefined,
  html: content.html ? interpolate(content.html, variables) : undefined,
});

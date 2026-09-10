/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
/// <reference path="../mjmlParserXml.d.ts" />
import type { SyncPreflightCheck } from '@template/email/preflight/types';
import parseMjml, { type MjmlParserNode } from 'mjml-parser-xml';

const hasMjPreview = (node: MjmlParserNode): boolean =>
  node.tagName === 'mj-preview' || (node.children ?? []).some(hasMjPreview);

export const preheaderPresent: SyncPreflightCheck = ({ mjml }) =>
  hasMjPreview(parseMjml(mjml))
    ? []
    : [
        {
          code: 'preheader.missing',
          severity: 'warning',
          message: 'No preheader (<mj-preview>) — inbox clients will show the first body text instead.',
          location: 'mjml',
        },
      ];

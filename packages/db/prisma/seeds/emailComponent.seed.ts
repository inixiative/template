/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:seed
 * @uses none
 */
import type { EmailComponent } from '../../src/generated/client/client';
import type { SeedFile } from '../seed';

export const emailComponentSeeds: SeedFile<EmailComponent> = {
  model: 'emailComponent',
  savedByApp: true,
  records: [
    {
      id: '01936d42-ec00-7000-8000-000000000003',
      slug: 'system-head',
      locale: 'en',
      ownerModel: 'default',
      inheritToSpaces: true,
      componentSlugs: [],
      mjml: [
        '<mj-attributes>',
        '  <mj-all font-family="-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif" />',
        '  <mj-text font-size="16px" line-height="26px" color="#374151" padding="0 0 16px" />',
        '  <mj-section padding="0" />',
        '  <mj-button background-color="#2563eb" color="#ffffff" font-size="16px" font-weight="600" border-radius="8px" inner-padding="14px 28px" padding="8px 0 24px" align="left" />',
        '  <mj-class name="card" background-color="#ffffff" border="1px solid #e5e7eb" border-radius="12px" padding="40px 40px 24px" />',
        '  <mj-class name="heading" font-size="24px" line-height="32px" font-weight="700" color="#111827" padding="0 0 16px" />',
        '  <mj-class name="note" font-size="14px" line-height="22px" color="#6b7280" />',
        '  <mj-class name="link" font-size="13px" line-height="20px" color="#2563eb" />',
        '  <mj-class name="header" padding="32px 41px 24px" />',
        '  <mj-class name="brand" font-size="20px" line-height="28px" font-weight="700" color="#111827" padding="0" />',
        '  <mj-class name="footer" padding="24px 41px 40px" />',
        '  <mj-class name="fine-print" font-size="12px" line-height="18px" color="#9ca3af" padding="0" css-class="fine-print" />',
        '</mj-attributes>',
        '<mj-style>',
        '  a { color: #2563eb; }',
        '  .fallback-link a { word-break: break-all; }',
        '</mj-style>',
        '<mj-style inline="inline">',
        '  .fine-print a { color: #9ca3af; }',
        '</mj-style>',
      ].join('\n'),
    },
    {
      id: '01936d42-ec00-7000-8000-000000000001',
      slug: 'system-header',
      locale: 'en',
      ownerModel: 'default',
      inheritToSpaces: true,
      componentSlugs: [],
      mjml: [
        '<mj-section mj-class="header">',
        '  <mj-column>',
        '    <mj-text mj-class="brand">',
        '      {{system.platformName}}',
        '    </mj-text>',
        '  </mj-column>',
        '</mj-section>',
      ].join('\n'),
    },
    {
      id: '01936d42-ec00-7000-8000-000000000002',
      slug: 'system-footer',
      locale: 'en',
      ownerModel: 'default',
      inheritToSpaces: true,
      componentSlugs: [],
      mjml: [
        '<mj-section mj-class="footer">',
        '  <mj-column>',
        '    <mj-text mj-class="fine-print">',
        '      &#169; {{system.year}} {{system.platformName}} &#183; <a href="{{system.webUrl}}">{{system.webUrl}}</a>',
        '    </mj-text>',
        '  </mj-column>',
        '</mj-section>',
      ].join('\n'),
    },
  ],
};

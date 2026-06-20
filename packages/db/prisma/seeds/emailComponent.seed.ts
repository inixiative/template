/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { EmailComponent } from '../../src/generated/client/client';
import type { SeedFile } from '../seed';

export const emailComponentSeeds: SeedFile<EmailComponent> = {
  model: 'emailComponent',
  updateOmitFields: ['createdAt'],
  records: [
    {
      id: '01936d42-ec00-7000-8000-000000000001',
      slug: 'system-header',
      locale: 'en',
      ownerModel: 'default',
      inheritToSpaces: true,
      componentRefs: [],
      mjml: [
        '<mj-section padding="20px 0">',
        '  <mj-column>',
        '    <mj-text align="center" font-size="24px" font-weight="bold" color="#111827">',
        '      {{sender.platformName}}',
        '    </mj-text>',
        '  </mj-column>',
        '</mj-section>',
        '<mj-divider border-color="#e5e7eb" border-width="1px" />',
      ].join('\n'),
    },
    {
      id: '01936d42-ec00-7000-8000-000000000002',
      slug: 'system-footer',
      locale: 'en',
      ownerModel: 'default',
      inheritToSpaces: true,
      componentRefs: [],
      mjml: [
        '<mj-divider border-color="#e5e7eb" border-width="1px" />',
        '<mj-section padding="20px 0">',
        '  <mj-column>',
        '    <mj-text align="center" font-size="12px" color="#6b7280">',
        '      {{sender.platformName}}',
        '    </mj-text>',
        '  </mj-column>',
        '</mj-section>',
      ].join('\n'),
    },
  ],
};

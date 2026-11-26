/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:seed
 * @uses none
 */
import type { EmailTemplate } from '../../src/generated/client/client';
import type { SeedFile } from '../seed';

const greeting =
  'Hi {{#if rule={"field":"recipient.name","operator":"exists"}}}{{recipient.name}}{{else}}there{{/if}},';

const systemEmail = ({ preview, body }: { preview: string; body: string[] }): string =>
  [
    '<mjml>',
    '  <mj-head>',
    '    {{#component:system-styles}}{{/component:system-styles}}',
    `    <mj-preview>${preview}</mj-preview>`,
    '  </mj-head>',
    '  <mj-body background-color="#f3f4f6" width="560px">',
    '    {{#component:system-header}}{{/component:system-header}}',
    '    <mj-wrapper mj-class="card">',
    '      <mj-section>',
    '        <mj-column>',
    ...body.map((line) => `          ${line}`),
    '        </mj-column>',
    '      </mj-section>',
    '    </mj-wrapper>',
    '    {{#component:system-footer}}{{/component:system-footer}}',
    '  </mj-body>',
    '</mjml>',
  ].join('\n');

const fallbackLink = (url: string): string[] => [
  '<mj-text mj-class="note" padding="0 0 4px">If the button does not work, paste this link into your browser:</mj-text>',
  `<mj-text mj-class="fallback-link" css-class="fallback-link" padding="0 0 16px"><a href="${url}">${url}</a></mj-text>`,
];

const componentSlugs = ['system-styles', 'system-header', 'system-footer'];

export const emailTemplateSeeds: SeedFile<EmailTemplate> = {
  model: 'emailTemplate',
  savedByApp: true,
  records: [
    {
      id: '01936d42-ec00-7000-8000-000000000010',
      slug: 'email-verification',
      name: 'Email Verification',
      locale: 'en',
      ownerModel: 'default',
      kind: 'system',
      inheritToSpaces: true,
      componentSlugs,
      subject: 'Verify your email address',
      mjml: systemEmail({
        preview: 'One click to finish setting up your {{system.platformName}} account.',
        body: [
          '<mj-text mj-class="heading">Verify your email</mj-text>',
          `<mj-text>${greeting}</mj-text>`,
          '<mj-text>Verify your email address to finish setting up your {{system.platformName}} account.</mj-text>',
          '<mj-button href="{{data.verificationUrl}}">Verify email address</mj-button>',
          ...fallbackLink('{{data.verificationUrl}}'),
          '<mj-divider border-color="#e5e7eb" border-width="1px" padding="0 0 16px" />',
          '<mj-text mj-class="note">If you did not create an account, you can ignore this email.</mj-text>',
        ],
      }),
    },
    {
      id: '01936d42-ec00-7000-8000-000000000013',
      slug: 'password-reset',
      name: 'Password Reset',
      locale: 'en',
      ownerModel: 'default',
      kind: 'system',
      inheritToSpaces: true,
      componentSlugs,
      subject: 'Reset your {{system.platformName}} password',
      mjml: systemEmail({
        preview: 'Use this link to choose a new password. It expires in one hour.',
        body: [
          '<mj-text mj-class="heading">Reset your password</mj-text>',
          `<mj-text>${greeting}</mj-text>`,
          '<mj-text>We received a request to reset the password for <strong>{{recipient.email}}</strong>. Choose a new one with the button below.</mj-text>',
          '<mj-button href="{{data.passwordResetUrl}}">Choose a new password</mj-button>',
          ...fallbackLink('{{data.passwordResetUrl}}'),
          '<mj-divider border-color="#e5e7eb" border-width="1px" padding="0 0 16px" />',
          '<mj-text mj-class="note">This link expires in one hour and works once. If you did not ask to reset your password, ignore this email; your password stays the same.</mj-text>',
        ],
      }),
    },
    {
      id: '01936d42-ec00-7000-8000-000000000011',
      slug: 'inquiry-invite-organization-user',
      name: 'Organization Invitation',
      locale: 'en',
      ownerModel: 'default',
      kind: 'system',
      inheritToSpaces: true,
      componentSlugs,
      subject:
        'You\'re invited to join {{#if rule={"field":"data.sourceOrganization.name","operator":"exists"}}}{{data.sourceOrganization.name}}{{else}}an organization{{/if}} on {{system.platformName}}',
      mjml: systemEmail({
        preview:
          'Accept the invitation to start working with {{#if rule={"field":"data.sourceOrganization.name","operator":"exists"}}}{{data.sourceOrganization.name}}{{else}}your team{{/if}}.',
        body: [
          '<mj-text mj-class="heading">You\'re invited to join {{#if rule={"field":"data.sourceOrganization.name","operator":"exists"}}}{{data.sourceOrganization.name}}{{else}}an organization{{/if}}</mj-text>',
          `<mj-text>${greeting}</mj-text>`,
          '<mj-text>{{#if rule={"field":"data.sourceOrganization.name","operator":"exists"}}}<strong>{{data.sourceOrganization.name}}</strong>{{else}}An organization{{/if}} invited you to join them on {{system.platformName}}{{#if rule={"field":"data.content.role","operator":"exists"}}} with the <strong>{{data.content.role}}</strong> role{{/if}}.</mj-text>',
          '<mj-button href="{{system.webUrl}}/organizations/invitations">View invitation</mj-button>',
          '<mj-divider border-color="#e5e7eb" border-width="1px" padding="0 0 16px" />',
          '<mj-text mj-class="note">This invitation expires in 30 days. If you were not expecting it, you can ignore this email.</mj-text>',
        ],
      }),
    },
    {
      id: '01936d42-ec00-7000-8000-000000000012',
      slug: 'welcome',
      name: 'Welcome',
      locale: 'en',
      ownerModel: 'default',
      kind: 'system',
      inheritToSpaces: true,
      componentSlugs,
      subject: 'Welcome to {{system.platformName}}',
      mjml: systemEmail({
        preview: 'Your account is ready.',
        body: [
          '<mj-text mj-class="heading">Welcome to {{system.platformName}}</mj-text>',
          `<mj-text>${greeting}</mj-text>`,
          '<mj-text>Your {{system.platformName}} account for <strong>{{recipient.email}}</strong> is ready. Everything you set up is saved to it, so you can pick up where you left off.</mj-text>',
          '<mj-button href="{{system.webUrl}}">Open {{system.platformName}}</mj-button>',
        ],
      }),
    },
  ],
};

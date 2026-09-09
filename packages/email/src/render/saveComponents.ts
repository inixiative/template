/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { EmailComponent } from '@template/db/generated/client/client';
import { MjmlValidationError } from '@template/email/errors/MjmlValidationError';
import { parseBlocks } from '@template/email/render/parseBlocks';
import { saveScopedRow } from '@template/email/render/saveScopedRow';
import type { OwnerScope } from '@template/email/render/types';
import { deriveComponentExpectations } from '@template/email/rules/componentExpectations';
import { assertNoDuplicateExposedSlots } from '@template/email/validations/assertNoDuplicateExposedSlots';
import { assertValidConditions } from '@template/email/validations/validateConditions';
import { validateMjml } from '@template/email/validations/validateMjml';

const componentValidationDocuments = (mjml: string): string[] => [
  `<mjml><mj-body>${mjml}</mj-body></mjml>`,
  `<mjml><mj-head>${mjml}</mj-head><mj-body></mj-body></mjml>`,
  `<mjml><mj-head><mj-attributes>${mjml}</mj-attributes></mj-head><mj-body></mj-body></mjml>`,
  `<mjml><mj-body><mj-section><mj-column>${mjml}</mj-column></mj-section></mj-body></mjml>`,
  `<mjml><mj-body><mj-section><mj-column><mj-navbar>${mjml}</mj-navbar></mj-column></mj-section></mj-body></mjml>`,
  `<mjml><mj-body><mj-section><mj-column><mj-social>${mjml}</mj-social></mj-column></mj-section></mj-body></mjml>`,
  `<mjml><mj-body><mj-section><mj-column><mj-accordion>${mjml}</mj-accordion></mj-column></mj-section></mj-body></mjml>`,
  `<mjml><mj-body><mj-section><mj-column><mj-carousel>${mjml}</mj-carousel></mj-column></mj-section></mj-body></mjml>`,
];

const validateComponentMjml = async (mjml: string): Promise<void> => {
  if (/<\/?mjml(\s|>)/i.test(mjml) || /<\/?mj-body(\s|>)/i.test(mjml)) {
    throw new MjmlValidationError([
      { line: 1, tagName: 'mjml', message: 'Email components must be MJML fragments, not complete MJML documents' },
    ]);
  }

  let lastError: unknown;
  for (const document of componentValidationDocuments(mjml)) {
    try {
      await validateMjml(document);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const depthFirstOrder = (inputs: EmailComponent[]): EmailComponent[] => {
  const bySlug = new Map(inputs.map((c) => [c.slug, c]));
  const visited = new Set<string>();
  const ordered: EmailComponent[] = [];

  const visit = (component: EmailComponent) => {
    if (visited.has(component.slug)) return;
    visited.add(component.slug);
    for (const ref of component.componentRefs ?? []) {
      const child = bySlug.get(ref);
      if (child) visit(child);
    }
    ordered.push(component);
  };

  for (const input of inputs) visit(input);
  return ordered;
};

export const saveComponents = async (inputs: EmailComponent[], ctx: OwnerScope): Promise<EmailComponent[]> => {
  const saved: EmailComponent[] = [];
  for (const input of depthFirstOrder(inputs)) {
    saved.push(await saveComponent(input, ctx));
  }
  return saved;
};

const saveComponent = async (input: EmailComponent, ctx: OwnerScope): Promise<EmailComponent> => {
  await validateComponentMjml(input.mjml);
  assertNoDuplicateExposedSlots(parseBlocks(input.mjml), input.slug);
  assertValidConditions(input.mjml);

  return saveScopedRow('emailComponent', { ...input, expectations: deriveComponentExpectations(input.mjml) }, ctx);
};

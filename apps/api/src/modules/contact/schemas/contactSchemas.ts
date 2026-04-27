import { ContactScalarInputSchema, ContactScalarSchema } from '@template/db';
import { z } from 'zod';

// Body for create — caller picks type/value/etc; ownership is injected from
// the route's parent (me / organization / space).
export const contactCreateBodySchema = z.object({
  type: ContactScalarInputSchema.shape.type,
  subtype: z.string().optional(),
  label: z.string().optional(),
  // value is loose at the API boundary (URL paste, etc.); the contactRules
  // hook normalizes via the type registry and owns validation.
  value: z.any(),
  isPrimary: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  source: z.string().optional(),
});

export const contactUpdateBodySchema = contactCreateBodySchema.partial();

export const contactReadResponseSchema = ContactScalarSchema;

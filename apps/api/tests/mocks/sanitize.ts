/**
 * Field-path redactor for VCR fixtures.
 *
 * Specify the exact fields to redact per fixture — no guessing, no broad regex.
 * Paths use dot notation. Arrays are traversed automatically, so a path like
 * 'choices.message.content' redacts content on every item in the choices array.
 *
 * @example
 * redact(completion, ['id', 'system_fingerprint', 'choices.message.content'])
 */

const redactPath = (obj: unknown, parts: string[]): void => {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) redactPath(item, parts);
    return;
  }

  const record = obj as Record<string, unknown>;
  const [head, ...rest] = parts;

  if (rest.length === 0) {
    if (head in record) record[head] = 'REDACTED';
  } else {
    redactPath(record[head], rest);
  }
};

export const redact = <T>(data: T, fields: string[]): T => {
  if (!fields.length) return data;
  const clone = JSON.parse(JSON.stringify(data)) as T;
  for (const field of fields) redactPath(clone, field.split('.'));
  return clone;
};

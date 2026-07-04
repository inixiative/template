/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
export type MatrixIssue = { path: string; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const lensKeys = (lenses: unknown, side: 'senders' | 'recipients'): Set<string> => {
  if (!isRecord(lenses) || !isRecord(lenses[side])) return new Set();
  return new Set(Object.keys(lenses[side] as Record<string, unknown>));
};

export const validateMatrix = (matrix: unknown, lenses: unknown): MatrixIssue[] => {
  if (matrix === null || matrix === undefined) return [];

  if (!isRecord(matrix) || !('paths' in matrix)) {
    return [{ path: '$', message: 'matrix must be an object with a `paths` array' }];
  }
  const { paths } = matrix;
  if (!Array.isArray(paths)) return [{ path: '$.paths', message: 'matrix.paths must be an array' }];
  if (paths.length === 0) {
    return [{ path: '$.paths', message: 'matrix must declare at least one sender→recipient path' }];
  }
  if (!isRecord(lenses)) {
    return [{ path: '$', message: 'matrix references lens keys, but the template declares no `lenses`' }];
  }

  const senders = lensKeys(lenses, 'senders');
  const recipients = lensKeys(lenses, 'recipients');
  const issues: MatrixIssue[] = [];

  paths.forEach((path, i) => {
    const at = `$.paths[${i}]`;
    if (!isRecord(path)) {
      issues.push({ path: at, message: 'path must be an object { from, to }' });
      return;
    }
    if (typeof path.from !== 'string') {
      issues.push({ path: `${at}.from`, message: 'from must be a sender lens key' });
    } else if (!senders.has(path.from)) {
      issues.push({ path: `${at}.from`, message: `from references an undeclared sender lens "${path.from}"` });
    }
    if (!Array.isArray(path.to) || path.to.length === 0) {
      issues.push({ path: `${at}.to`, message: 'to must be a non-empty array of recipient lens keys' });
    } else {
      path.to.forEach((key, j) => {
        if (typeof key !== 'string' || !recipients.has(key)) {
          issues.push({ path: `${at}.to[${j}]`, message: `to references an undeclared recipient lens "${String(key)}"` });
        }
      });
    }
  });
  return issues;
};

export class MatrixValidationError extends Error {
  readonly issues: MatrixIssue[];

  constructor(issues: MatrixIssue[]) {
    super(`Invalid send matrix:\n${issues.map((x) => `  ${x.path}: ${x.message}`).join('\n')}`);
    this.name = 'MatrixValidationError';
    this.issues = issues;
  }
}

export const assertValidMatrix = (matrix: unknown, lenses: unknown): void => {
  const issues = validateMatrix(matrix, lenses);
  if (issues.length > 0) throw new MatrixValidationError(issues);
};

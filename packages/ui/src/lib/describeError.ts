/**
 * @atlas
 * @kind helper, error
 * @partOf primitive:ui
 * @uses none
 */
export type DescribedError = { message: string; detail?: string };

const rawMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    for (const key of ['message', 'error', 'code', 'statusText']) {
      if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string;
    }
  }
  return undefined;
};

export const describeError = (error: unknown, friendly?: string): DescribedError => {
  if (friendly) {
    const detail = rawMessage(error);
    return { message: friendly, detail: detail === friendly ? undefined : detail };
  }
  if (error instanceof Error) return { message: error.message, detail: error.stack };
  if (error && typeof error === 'object') {
    return { message: rawMessage(error) || 'Request failed', detail: JSON.stringify(error, null, 2) };
  }
  return { message: String(error) };
};

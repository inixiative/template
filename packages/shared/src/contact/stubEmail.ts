/**
 * @atlas
 * @kind helper
 * @partOf primitive:shared
 * @uses none
 */
export const stubEmailDomain = (type: string): string => {
  const project = process.env.PROJECT_NAME ?? 'app';
  return `${type}.${project}`;
};

export const phoneToStubEmail = (rawDigits: string, type: string): string => {
  const digits = rawDigits.replace(/[^0-9]/g, '');
  return `${digits}@${stubEmailDomain(type)}`;
};

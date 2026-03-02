export type SelectOption<TValue extends string = string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
};

type EnumLike = Record<string, string | number>;

const numericKeyPattern = /^\d+$/;

export const formatEnumLabel = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const enumToSelectOptions = <TValue extends string>(
  source: EnumLike | readonly TValue[],
  labelFormatter: (value: TValue) => string = (value) => formatEnumLabel(value),
): SelectOption<TValue>[] => {
  const values = Array.isArray(source)
    ? source
    : Object.entries(source)
        .filter(([key]) => !numericKeyPattern.test(key))
        .map(([, value]) => String(value) as TValue);

  return Array.from(new Set(values)).map((value) => ({
    value,
    label: labelFormatter(value),
  }));
};

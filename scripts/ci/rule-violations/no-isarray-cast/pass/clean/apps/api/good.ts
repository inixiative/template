import { castArray } from 'lodash-es';

export const toArray = (value: unknown): unknown[] => castArray(value);

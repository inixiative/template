/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import {
  createLens,
  exposedSurface,
  type FieldMap,
  type FieldMapEntry,
  type Lens,
  type LensNarrowing,
  type ModelNarrowing,
  validateNarrowing,
} from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import type { ModelName } from '@template/db/utils/modelNames';

export const EMAIL_RULE_ROOT_MODEL = 'EmailRuleContext';
export const EMAIL_DATA_MODEL = 'EmailData';
export const EMAIL_RULE_MAP_NAME = 'prisma';

export type EmailContextRelation = { name: string; model: ModelName; isList?: boolean };

export type EmailDataProjection =
  | { kind: 'model'; model: ModelName }
  | { kind: 'fields'; fields: Record<string, string> }
  | { kind: 'relations'; relations: EmailContextRelation[] };

export type EmailProjectionInput = {
  recipientModel?: ModelName;
  senderModel?: ModelName | null;
  data?: EmailDataProjection;
};

export type EmailDataLens = { model?: ModelName; narrowing?: ModelNarrowing };

export type EmailSlotLenses = {
  recipient?: ModelNarrowing;
  sender?: ModelNarrowing;
  data?: EmailDataLens;
};

export const DEFAULT_RECIPIENT_LENS: ModelNarrowing = { picks: ['id', 'name', 'email'] };

const OPAQUE_DATA: FieldMapEntry = { kind: 'scalar', type: 'Json' };

const relation = (model: string, relationName: string, isList = false): FieldMapEntry => ({
  kind: 'object',
  type: model,
  isList,
  relationName,
  fromFields: [],
  toFields: [],
});

const dataModelEntry = (data: EmailDataProjection): FieldMap['models'][string] | null => {
  switch (data.kind) {
    case 'model':
      return null;
    case 'fields':
      return {
        fields: Object.fromEntries(Object.entries(data.fields).map(([name, type]) => [name, { kind: 'scalar', type }])),
      };
    case 'relations':
      return {
        fields: Object.fromEntries(
          data.relations.map((rel) => [rel.name, relation(rel.model, `EmailData_${rel.name}`, rel.isList ?? false)]),
        ),
      };
  }
};

export const emailProjection = ({ recipientModel = 'User', senderModel, data }: EmailProjectionInput = {}): Lens => {
  const base = lensFor(recipientModel);
  const prisma = base.maps[base.mapName];
  if (!prisma) throw new Error(`Field map "${base.mapName}" missing from lens`);

  const dataEntry = data ? dataModelEntry(data) : null;
  const dataType = data?.kind === 'model' ? data.model : EMAIL_DATA_MODEL;

  const models: FieldMap['models'] = {
    ...prisma.models,
    ...(dataEntry ? { [EMAIL_DATA_MODEL]: dataEntry } : {}),
    [EMAIL_RULE_ROOT_MODEL]: {
      fields: {
        recipient: relation(recipientModel, 'EmailRecipient'),
        ...(senderModel ? { sender: relation(senderModel, 'EmailSender') } : {}),
        data: data ? relation(dataType, 'EmailDataRel') : OPAQUE_DATA,
      },
    },
  };

  return createLens({
    maps: { [EMAIL_RULE_MAP_NAME]: { ...prisma, models } },
    mapName: EMAIL_RULE_MAP_NAME,
    model: EMAIL_RULE_ROOT_MODEL,
  });
};

const allScalarPicks = (projection: Lens, model: string): ModelNarrowing => ({
  picks: Object.entries(projection.maps[EMAIL_RULE_MAP_NAME]?.models[model]?.fields ?? {})
    .filter(([, field]) => field.kind !== 'object' && field.kind !== 'bridge')
    .map(([name]) => name),
});

const rootFieldModel = (projection: Lens, field: string): string | undefined => {
  const entry = projection.maps[EMAIL_RULE_MAP_NAME]?.models[EMAIL_RULE_ROOT_MODEL]?.fields[field];
  return entry?.kind === 'object' ? entry.type : undefined;
};

const defaultDataLens = (projection: Lens, dataModel: string): ModelNarrowing => {
  const fields = projection.maps[EMAIL_RULE_MAP_NAME]?.models[dataModel]?.fields ?? {};
  const relations = Object.entries(fields).filter(([, field]) => field.kind === 'object');
  if (dataModel !== EMAIL_DATA_MODEL || relations.length === 0) return allScalarPicks(projection, dataModel);
  return {
    relations: Object.fromEntries(
      relations.map(([name, field]) => [name, allScalarPicks(projection, (field as { type: string }).type)]),
    ),
  };
};

export const emailLens = (projection: Lens, slots: EmailSlotLenses = {}): LensNarrowing => {
  const senderModel = rootFieldModel(projection, 'sender');
  const dataModel = rootFieldModel(projection, 'data');
  const narrowing: LensNarrowing = {
    parent: projection,
    root: {
      relations: {
        recipient: slots.recipient ?? DEFAULT_RECIPIENT_LENS,
        ...(senderModel ? { sender: slots.sender ?? allScalarPicks(projection, senderModel) } : {}),
        ...(dataModel ? { data: slots.data?.narrowing ?? defaultDataLens(projection, dataModel) } : {}),
      },
    },
  };
  validateNarrowing(narrowing);
  return narrowing;
};

export const emailSurface = (projection: Lens, slots?: EmailSlotLenses): Lens =>
  exposedSurface(emailLens(projection, slots));

const isNarrowing = (value: unknown): value is ModelNarrowing =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseDataLens = (value: unknown): EmailDataLens | undefined => {
  if (!isNarrowing(value)) return undefined;
  const doc = value as Record<string, unknown>;
  return {
    ...(typeof doc.model === 'string' ? { model: doc.model as ModelName } : {}),
    ...(isNarrowing(doc.narrowing) ? { narrowing: doc.narrowing } : {}),
  };
};

export const parseSlotLenses = (stored: unknown): EmailSlotLenses => {
  if (!isNarrowing(stored)) return {};
  const doc = stored as Record<string, unknown>;
  const data = parseDataLens(doc.data);
  return {
    ...(isNarrowing(doc.recipient) ? { recipient: doc.recipient } : {}),
    ...(isNarrowing(doc.sender) ? { sender: doc.sender } : {}),
    ...(data ? { data } : {}),
  };
};

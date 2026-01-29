import { db } from '@template/db/client';
import {
  FalsePolymorphismRegistry,
  type FalsePolymorphismRelation,
} from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

const generateCheckSql = (relation: FalsePolymorphismRelation): string => {
  const { typeField, fkMap } = relation;
  const allFks = [...new Set(Object.values(fkMap).flat())];
  const fkList = allFks.map((fk) => `"${fk}"`).join(', ');

  const conditions = Object.entries(fkMap).map(([type, required]) => {
    const checks = required.map((fk) => `"${fk}" IS NOT NULL`).join(' AND ');
    return `("${typeField}" = '${type}' AND num_nonnulls(${fkList}) = ${required.length} AND ${checks})`;
  });

  return `CHECK (${conditions.join(' OR ')})`;
};

export async function addPolymorphicConstraint(model: ModelName, relation: FalsePolymorphismRelation) {
  const name = `${model}_${relation.typeField}_polymorphic`;
  const check = generateCheckSql(relation);

  await db.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (SELECT FROM pg_constraint WHERE conname = '${name}') THEN
        ALTER TABLE "${model}" DROP CONSTRAINT "${name}";
      END IF;
    END $$;
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE "${model}" ADD CONSTRAINT "${name}" ${check};
  `);
}

export async function addAllPolymorphicConstraints() {
  for (const [model, relations] of Object.entries(FalsePolymorphismRegistry)) {
    for (const relation of relations ?? []) {
      await addPolymorphicConstraint(model as ModelName, relation);
    }
  }
}

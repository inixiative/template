import { db } from '@template/db/client';
import { PolymorphismRegistry, type PolymorphicAxis } from '@template/db/registries/falsePolymorphism';
import type { ModelName } from '@template/db/utils/modelNames';

const generateCheckSql = (axis: PolymorphicAxis): string => {
  const allFks = [...new Set(Object.values(axis.fkMap).flat())];
  const fkList = allFks.map((fk) => `"${fk}"`).join(', ');

  const conditions = Object.entries(axis.fkMap).map(([type, required]) => {
    const fks = required ?? [];
    const checks = fks.length ? fks.map((fk) => `"${fk}" IS NOT NULL`).join(' AND ') : 'TRUE';
    return `("${axis.field}" = '${type}' AND num_nonnulls(${fkList}) = ${fks.length}${fks.length ? ` AND ${checks}` : ''})`;
  });

  return `CHECK (${conditions.join(' OR ')})`;
};

export async function addPolymorphicConstraint(model: ModelName, axis: PolymorphicAxis) {
  const name = `${model}_${axis.field}_polymorphic`;
  const check = generateCheckSql(axis);

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
  for (const [model, config] of Object.entries(PolymorphismRegistry)) {
    if (!config) continue;
    for (const axis of config.axes) {
      await addPolymorphicConstraint(model as ModelName, axis);
    }
  }
}

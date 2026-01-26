import { db } from '@template/db/client';
import type { ModelName, PolymorphicConstraint, TableConstraints } from './types';

export const POLYMORPHIC_CONSTRAINTS: TableConstraints[] = [
  {
    model: 'Token',
    constraints: [
      {
        typeColumn: 'ownerModel',
        rules: [
          { type: 'User', required: ['userId'] },
          { type: 'Organization', required: ['organizationId'] },
          { type: 'OrganizationUser', required: ['userId', 'organizationId'] },
        ],
      },
    ],
  },
  {
    model: 'WebhookSubscription',
    constraints: [
      {
        typeColumn: 'ownerModel',
        rules: [
          { type: 'User', required: ['userId'] },
          { type: 'Organization', required: ['organizationId'] },
        ],
      },
    ],
  },
  {
    model: 'Inquiry',
    constraints: [
      {
        typeColumn: 'sourceModel',
        rules: [
          { type: 'User', required: ['sourceUserId'] },
          { type: 'Organization', required: ['sourceOrganizationId'] },
        ],
      },
      {
        typeColumn: 'targetModel',
        rules: [
          { type: 'User', required: ['targetUserId'] },
          { type: 'Organization', required: ['targetOrganizationId'] },
        ],
      },
    ],
  },
];

export const generatePolymorphicCheckSql = (constraint: PolymorphicConstraint): string => {
  const { typeColumn, rules } = constraint;
  const fkColumns = [...new Set(rules.flatMap((r) => r.required))];
  const fkList = fkColumns.join(', ');

  const conditions = rules.map(({ type, required }) => {
    const checks = required.map((fk) => `"${fk}" IS NOT NULL`).join(' AND ');
    return `("${typeColumn}" = '${type}' AND num_nonnulls(${fkList}) = ${required.length} AND ${checks})`;
  });

  return `CHECK (${conditions.join(' OR ')})`;
};

export async function addPolymorphicConstraint(model: ModelName, constraint: PolymorphicConstraint) {
  const name = `${model}_${constraint.typeColumn}_polymorphic`;
  const check = generatePolymorphicCheckSql(constraint);

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
  for (const { model, constraints } of POLYMORPHIC_CONSTRAINTS) {
    for (const constraint of constraints) {
      await addPolymorphicConstraint(model, constraint);
    }
  }
}

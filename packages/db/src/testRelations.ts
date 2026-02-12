import { getModelRelations } from '@template/db/utils/runtimeDataModel';

console.log('User relations:');
console.log(JSON.stringify(getModelRelations('User'), null, 2));

console.log('\nOrganizationUser relations:');
console.log(JSON.stringify(getModelRelations('OrganizationUser'), null, 2));

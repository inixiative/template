import fs from 'fs';
import path from 'path';

interface EndpointInfo {
  method: string;
  url: string;
  functionName: string;
}

const extractEndpoints = (sdkContent: string): EndpointInfo[] => {
  const endpoints: EndpointInfo[] = [];
  const lines = sdkContent.split('\n');

  let currentFunction = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const functionMatch = line.match(/export const (\w+) = /);
    if (functionMatch) {
      currentFunction = functionMatch[1];
    }

    const methodMatch = line.match(/\.(get|post|put|patch|delete)<.*>\(\{/);
    if (methodMatch && currentFunction) {
      const method = methodMatch[1].toUpperCase();

      const nextLine = lines[i + 1];
      const urlMatch = nextLine?.match(/url: ['"]([^'"]+)['"]/);

      if (urlMatch) {
        endpoints.push({
          method,
          url: urlMatch[1],
          functionName: currentFunction,
        });
        currentFunction = '';
      }
    }
  }

  return endpoints;
};

const generateHandlers = (endpoints: EndpointInfo[]): string => {
  const apiEndpoints = endpoints.filter((e) => e.url.startsWith('/api/v1') || e.url.startsWith('/api/admin'));

  const handlerCases: string[] = [];

  for (const endpoint of apiEndpoints) {
    const httpMethod = endpoint.method.toLowerCase();
    const comment = `// ${endpoint.method} ${endpoint.url} (${endpoint.functionName})`;

    handlerCases.push(`
  ${comment}
  http.${httpMethod}('*${endpoint.url}', () => {
    return HttpResponse.json({ data: null, error: 'Not implemented in MSW' });
  }),`);
  }

  return `import { http, HttpResponse } from 'msw';
import { buildUser, buildOrganizationUser, buildSpaceUser } from '@template/db/test';

// Auto-generated MSW handlers from SDK
//
// To customize a handler:
// 1. Find the endpoint below
// 2. Replace the default response with factory data
// 3. Add your custom logic
//
// Example:
// http.get('*/api/v1/me', () => {
//   const user = buildUser({ platformRole: 'user' });
//   return HttpResponse.json({ data: user });
// }),

export const handlers = [${handlerCases.join('')}
];
`;
};

const main = async () => {
  const sdkPath = path.join(process.cwd(), 'src/apiClient/sdk.gen.ts');

  const sdkContent = fs.readFileSync(sdkPath, 'utf-8');
  const endpoints = extractEndpoints(sdkContent);

  console.log(`Found ${endpoints.length} endpoints`);

  const handlersContent = generateHandlers(endpoints);

  const outputPath = path.join(process.cwd(), 'src/test/mocks/handlers.gen.ts');

  fs.writeFileSync(outputPath, handlersContent);

  console.log(`✓ Generated ${outputPath}`);
  console.log('  Customize handlers by editing the file or creating handlers.ts');
};

main().catch(console.error);

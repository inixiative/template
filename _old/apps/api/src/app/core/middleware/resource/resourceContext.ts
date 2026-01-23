import { Elysia } from 'elysia';
import { cache } from 'src/shared/cache';
import { resourceCacheConfig } from 'src/app/core/middleware/resource/cacheConfig';
import { resourceInclusions } from 'src/app/core/middleware/resource/inclusions';

export const resourceContext = new Elysia({ name: 'resourceContext' })
  .derive(async ({ params, query, path, db, redis, error }) => {
    // Only run on routes with :id parameter
    if (!params?.id) return { resource: null };
    
    // Determine resource type from path
    const resourceType = getResourceTypeFromPath(path);
    if (!resourceType) return { resource: null };
    
    // Get lookup configuration
    const lookupField = query?.lookup || 'id';
    const cacheKey = lookupField === 'id' 
      ? `${resourceType}:${params.id}`
      : `${resourceType}:${lookupField}:${params.id}`;
    const cacheConfig = resourceCacheConfig[resourceType];
    
    try {
      // Try to find the resource
      const resource = cacheConfig
        ? await cache(
            redis.cache,
            cacheKey,
            async () => fetchResource(db, resourceType, lookupField, params.id),
            typeof cacheConfig === 'number' ? cacheConfig : 86400 // Default 24h
          )
        : await fetchResource(db, resourceType, lookupField, params.id);
      
      if (!resource) {
        return error(404, { 
          error: 'Not Found', 
          message: `${resourceType} not found` 
        });
      }
      
      return { resource, resourceType };
    } catch (err) {
      console.error(`Error fetching ${resourceType}:`, err);
      return error(500, { 
        error: 'Internal Server Error', 
        message: 'Failed to fetch resource' 
      });
    }
  });

// Extract resource type from URL path
const getResourceTypeFromPath = (path: string): string | null => {
  // Match patterns like /api/core/users/:id or /api/products/:id
  const match = path.match(/\/api\/(?:core\/)?([^\/]+)\/:/);
  if (!match) return null;
  
  // Convert plural to singular (basic conversion)
  const plural = match[1];
  if (plural.endsWith('ies')) return plural.slice(0, -3) + 'y';
  if (plural.endsWith('s')) return plural.slice(0, -1);
  return plural;
};

// Fetch resource from database with proper typing
const fetchResource = async (
  db: any,
  resourceType: string,
  lookupField: string,
  value: string
): Promise<any> => {
  const model = db[resourceType];
  if (!model) throw new Error(`Model ${resourceType} not found`);
  
  const include = resourceInclusions[resourceType];
  
  return await model.findUnique({
    where: { [lookupField]: value },
    ...(include ? { include } : {})
  });
};
import { TSchema } from 'elysia';

const DEFAULT_SANITIZE_KEYS = ['id', 'createdAt', 'updatedAt'];

export const sanitizeBody = (schema: TSchema, keysToRemove: string[] = []): TSchema => {
  const allKeysToRemove = [...DEFAULT_SANITIZE_KEYS, ...keysToRemove];
  
  const sanitizeSchema = (obj: any, keysToRemove: string[]): any => {
    if (!obj || typeof obj !== 'object' || obj.type !== 'object' || !('properties' in obj)) return obj;
    
    const newObj = { ...obj };
    const newProps = { ...obj.properties };
    
    keysToRemove.forEach(keyPath => {
      const [key, ...path] = keyPath.split('.');
      
      if (path.length === 0) {
        delete newProps[key];
      } else if (newProps[key]) {
        newProps[key] = sanitizeSchema(newProps[key], [path.join('.')]);
      }
    });
    
    newObj.properties = newProps;
    return newObj;
  };
  
  return sanitizeSchema(schema, allKeysToRemove);
};
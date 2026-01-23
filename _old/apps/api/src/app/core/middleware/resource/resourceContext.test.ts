import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { Elysia } from 'elysia';
import { resourceContext } from 'src/app/core/middleware/resource/resourceContext';
import * as cacheModule from 'src/shared/cache';

describe('resourceContext middleware', () => {
  let app: Elysia;
  let cacheSpy: any;
  
  beforeEach(() => {
    app = new Elysia();
    // Mock the cache function
    cacheSpy = spyOn(cacheModule, 'cache');
  });
  
  it('should not add resource when no id parameter', async () => {
    const mockDb = {};
    const mockRedis = { cache: {} };
    
    app
      .decorate('db', mockDb)
      .decorate('redis', mockRedis)
      .use(resourceContext)
      .get('/test', (ctx) => ({ hasResource: 'resource' in ctx }));
    
    const response = await app.handle(new Request('http://localhost/test'));
    const data = await response.json();
    
    expect(data.hasResource).toBe(true);
  });
  
  it('should load resource from cache when available', async () => {
    const cachedUser = {
      id: '123',
      email: 'test@example.com',
      name: 'Test User'
    };
    
    const mockDb = {
      user: {
        findUnique: mock(() => null) // Should not be called
      }
    };
    
    const mockRedis = {
      cache: {}
    };
    
    cacheSpy.mockResolvedValue(cachedUser);
    
    app
      .decorate('db', mockDb)
      .decorate('redis', mockRedis)
      .use(resourceContext)
      .get('/api/core/users/:id', ({ resource }) => ({ resource }));
    
    const response = await app.handle(new Request('http://localhost/api/core/users/123'));
    const data = await response.json();
    
    expect(data.resource).toEqual(cachedUser);
    expect(cacheSpy).toHaveBeenCalledWith(
      mockRedis.cache,
      'user:123',
      expect.any(Function),
      3600
    );
  });
  
  it('should use lookup field in cache key when provided', async () => {
    const user = {
      id: '123',
      email: 'test@example.com',
      username: 'testuser'
    };
    
    const mockDb = {
      user: {
        findUnique: mock(() => user)
      }
    };
    
    const mockRedis = {
      cache: {
        get: mock(() => null),
        setex: mock(() => {})
      }
    };
    
    app
      .decorate('db', mockDb)
      .decorate('redis', mockRedis)
      .use(resourceContext)
      .get('/api/core/users/:id', ({ resource }) => ({ resource }));
    
    const response = await app.handle(
      new Request('http://localhost/api/core/users/testuser?lookup=username')
    );
    const data = await response.json();
    
    expect(data.resource).toEqual(user);
    expect(mockRedis.cache.get).toHaveBeenCalledWith('user:username:testuser');
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'testuser' },
      include: { accounts: true }
    });
  });
  
  it('should return 404 when resource not found', async () => {
    const mockDb = {
      user: {
        findUnique: mock(() => null)
      }
    };
    
    const mockRedis = {
      cache: {
        get: mock(() => null),
        setex: mock(() => {})
      }
    };
    
    app
      .decorate('db', mockDb)
      .decorate('redis', mockRedis)
      .use(resourceContext)
      .get('/api/core/users/:id', ({ resource }) => ({ resource }));
    
    const response = await app.handle(new Request('http://localhost/api/core/users/999'));
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Not Found');
    expect(data.message).toBe('user not found');
  });
  
  it('should handle singular/plural resource type conversion', async () => {
    const mockDb = {
      category: { findUnique: mock(() => ({ id: '1', name: 'Test' })) },
      story: { findUnique: mock(() => ({ id: '2', title: 'Test' })) }
    };
    
    const mockRedis = {
      cache: {
        get: mock(() => null),
        setex: mock(() => {})
      }
    };
    
    app
      .decorate('db', mockDb)
      .decorate('redis', mockRedis)
      .use(resourceContext)
      .get('/api/categories/:id', ({ resourceType }) => ({ resourceType }))
      .get('/api/stories/:id', ({ resourceType }) => ({ resourceType }));
    
    // Test 'categories' -> 'category'
    const res1 = await app.handle(new Request('http://localhost/api/categories/1'));
    const data1 = await res1.json();
    expect(data1.resourceType).toBe('category');
    
    // Test 'stories' -> 'story'
    const res2 = await app.handle(new Request('http://localhost/api/stories/2'));
    const data2 = await res2.json();
    expect(data2.resourceType).toBe('story');
  });
});
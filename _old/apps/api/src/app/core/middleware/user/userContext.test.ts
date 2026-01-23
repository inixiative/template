import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { userContext } from 'src/app/core/middleware/user/userContext';

describe('userContext middleware', () => {
  let app: Elysia;
  
  beforeEach(() => {
    app = new Elysia();
  });
  
  it('should set user to null when no auth is present', async () => {
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
      .decorate('auth', null)
      .decorate('db', mockDb)
      .decorate('redis', mockRedis)
      .use(userContext)
      .get('/test', ({ user }) => ({ user }));
    
    const response = await app.handle(new Request('http://localhost/test'));
    const data = await response.json();
    
    expect(data.user).toBeNull();
  });
  
  it('should load user from cache when available', async () => {
    const cachedUser = {
      id: '123',
      email: 'test@example.com',
      accounts: []
    };
    
    const mockDb = {
      user: {
        findUnique: mock(() => null) // Should not be called
      }
    };
    
    const mockRedis = {
      cache: {
        get: mock(() => JSON.stringify(cachedUser)),
        setex: mock(() => {})
      }
    };
    
    const mockAuth = {
      user: { id: '123' }
    };
    
    app
      .decorate('auth', mockAuth)
      .decorate('db', mockDb)
      .decorate('redis', mockRedis)
      .use(userContext)
      .get('/test', ({ user }) => ({ user }));
    
    const response = await app.handle(new Request('http://localhost/test'));
    const data = await response.json();
    
    expect(data.user).toEqual(cachedUser);
    expect(mockRedis.cache.get).toHaveBeenCalledWith('user:123');
    expect(mockDb.user.findUnique).not.toHaveBeenCalled();
  });
  
  it('should load user from database and cache when not in cache', async () => {
    const dbUser = {
      id: '123',
      email: 'test@example.com',
      accounts: []
    };
    
    const mockDb = {
      user: {
        findUnique: mock(() => dbUser)
      }
    };
    
    const mockRedis = {
      cache: {
        get: mock(() => null),
        setex: mock(() => {})
      }
    };
    
    const mockAuth = {
      user: { id: '123' }
    };
    
    app
      .decorate('auth', mockAuth)
      .decorate('db', mockDb)
      .decorate('redis', mockRedis)
      .use(userContext)
      .get('/test', ({ user }) => ({ user }));
    
    const response = await app.handle(new Request('http://localhost/test'));
    const data = await response.json();
    
    expect(data.user).toEqual(dbUser);
    expect(mockRedis.cache.get).toHaveBeenCalledWith('user:123');
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { id: '123' },
      include: { accounts: true }
    });
    expect(mockRedis.cache.setex).toHaveBeenCalledWith(
      'user:123',
      3600,
      JSON.stringify(dbUser)
    );
  });
  
  describe('requireAuth macro', () => {
    it('should allow access when user is authenticated', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      
      app
        .decorate('user', mockUser)
        .use(userContext)
        .get('/protected', () => ({ success: true }), {
          requireAuth: true
        });
      
      const response = await app.handle(new Request('http://localhost/protected'));
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
    
    it('should return 401 when user is not authenticated', async () => {
      app
        .decorate('user', null)
        .use(userContext)
        .get('/protected', () => ({ success: true }), {
          requireAuth: true
        });
      
      const response = await app.handle(new Request('http://localhost/protected'));
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toBe('You are not logged in');
    });
    
    it('should allow access when requireAuth is false', async () => {
      app
        .decorate('user', null)
        .use(userContext)
        .get('/public', () => ({ success: true }), {
          requireAuth: false
        });
      
      const response = await app.handle(new Request('http://localhost/public'));
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
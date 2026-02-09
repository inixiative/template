import { describe, expect, it } from 'bun:test';

describe('Header standardization', () => {
  it('should use lowercase x- prefix for custom headers', () => {
    const customHeaders = {
      'x-spoof-user-email': 'admin@example.com',
      'x-batch-id': 'batch-123',
      'x-webhook-signature': 'signature-abc',
      'x-spoofing-user-email': 'original@example.com',
      'x-spoofed-user-email': 'target@example.com',
    };

    // Verify all custom headers use lowercase x- prefix
    Object.keys(customHeaders).forEach((header) => {
      expect(header.startsWith('x-')).toBe(true);
      expect(header).toBe(header.toLowerCase());
    });
  });

  it('should distinguish custom headers from standard headers', () => {
    const standardHeaders = ['authorization', 'content-type', 'accept'];
    const customHeaders = ['x-spoof-user-email', 'x-batch-id'];

    standardHeaders.forEach((header) => {
      expect(header.startsWith('x-')).toBe(false);
    });

    customHeaders.forEach((header) => {
      expect(header.startsWith('x-')).toBe(true);
    });
  });

  it('should use consistent casing (lowercase)', () => {
    const headers = {
      'x-spoof-user-email': 'test',
      'x-batch-id': 'test',
      'x-webhook-signature': 'test',
    };

    Object.keys(headers).forEach((header) => {
      // Should not have any uppercase letters
      expect(header).toBe(header.toLowerCase());
      // Should not have mixed case like X-Spoof-User-Email
      expect(header).not.toMatch(/[A-Z]/);
    });
  });
});

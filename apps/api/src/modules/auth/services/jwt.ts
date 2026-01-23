import { env } from '@src/config/env';

// Simple JWT implementation using Web Crypto API
// In production, use a proper JWT library

const JWT_SECRET = env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

type JwtPayload = {
  sub: string; // user id
  email: string;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

async function createHmacKey() {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function base64UrlEncode(data: string | ArrayBuffer): string {
  const str = typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

export async function signJwt(userId: string, email: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const payload: JwtPayload = {
    sub: userId,
    email,
    iat: now,
    exp: now + JWT_EXPIRY,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;

  const key = await createHmacKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureB64 = base64UrlEncode(signature);

  return `${message}.${signatureB64}`;
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const message = `${headerB64}.${payloadB64}`;
    const key = await createHmacKey();

    // Decode signature
    const signatureStr = base64UrlDecode(signatureB64);
    const signature = new Uint8Array(signatureStr.length);
    for (let i = 0; i < signatureStr.length; i++) {
      signature[i] = signatureStr.charCodeAt(i);
    }

    const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(message));
    if (!valid) return null;

    const payload: JwtPayload = JSON.parse(base64UrlDecode(payloadB64));

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

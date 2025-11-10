// Authentication middleware

import { Context, Next } from 'hono';
import { Bindings, Variables } from '../types/bindings';

/**
 * Simple JWT-like token verification
 * In production, use proper JWT library
 */
export async function verifyAuth(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  
  try {
    // Simple token validation (in production, use proper JWT)
    const [userId, role, signature] = token.split('.');
    
    if (!userId || !role || !signature) {
      throw new Error('Invalid token format');
    }

    // Verify signature (simplified)
    const expectedSignature = await simpleHash(`${userId}.${role}.${c.env.JWT_SECRET}`);
    
    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }

    // Set user info in context
    c.set('userId', parseInt(userId));
    c.set('userRole', role as 'user' | 'admin');
    
    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
}

/**
 * Admin-only middleware
 */
export async function requireAdmin(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next
) {
  const role = c.get('userRole');
  
  if (role !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403);
  }
  
  await next();
}

/**
 * Simple hash function for token signing
 * In production, use Web Crypto API properly
 */
async function simpleHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate authentication token
 */
export async function generateToken(userId: number, role: string, jwtSecret: string): Promise<string> {
  const signature = await simpleHash(`${userId}.${role}.${jwtSecret}`);
  return `${userId}.${role}.${signature}`;
}

/**
 * Hash password using Web Crypto API
 */
export async function hashPassword(password: string, salt?: string): Promise<string> {
  const actualSalt = salt || crypto.randomUUID();
  const encoder = new TextEncoder();
  const data = encoder.encode(password + actualSalt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${actualSalt}:${hash}`;
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const [salt, hash] = hashedPassword.split(':');
  const newHash = await hashPassword(password, salt);
  return newHash === hashedPassword;
}

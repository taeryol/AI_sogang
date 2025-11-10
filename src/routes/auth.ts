// Authentication routes

import { Hono } from 'hono';
import { Bindings, Variables } from '../types/bindings';
import { LoginRequest, LoginResponse } from '../types/models';
import { generateToken, hashPassword, verifyPassword } from '../middleware/auth';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * POST /api/auth/login
 * User login
 */
auth.post('/login', async (c) => {
  try {
    const body: LoginRequest = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    // Find user by email
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash as string);
    
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Generate token
    const token = await generateToken(user.id as number, user.role as string, c.env.JWT_SECRET);

    const response: LoginResponse = {
      token,
      user: {
        id: user.id as number,
        email: user.email as string,
        name: user.name as string,
        role: user.role as string
      }
    };

    return c.json(response);
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Login failed' }, 500);
  }
});

/**
 * POST /api/auth/register
 * User registration (admin only in production)
 */
auth.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, role = 'user' } = body;

    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400);
    }

    // Check if user exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return c.json({ error: 'User already exists' }, 409);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert new user
    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)'
    ).bind(email, name, passwordHash, role).run();

    if (!result.success) {
      throw new Error('Failed to create user');
    }

    // Get the created user
    const newUser = await c.env.DB.prepare(
      'SELECT id, email, name, role FROM users WHERE email = ?'
    ).bind(email).first();

    return c.json({
      message: 'User created successfully',
      user: newUser
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

/**
 * POST /api/auth/change-password
 * Change user password (authenticated)
 */
auth.post('/change-password', async (c) => {
  try {
    const userId = c.get('userId');
    
    if (!userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return c.json({ error: 'Old and new passwords are required' }, 400);
    }

    // Get user
    const user = await c.env.DB.prepare(
      'SELECT password_hash FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verify old password
    const isValid = await verifyPassword(oldPassword, user.password_hash as string);
    
    if (!isValid) {
      return c.json({ error: 'Invalid old password' }, 401);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(newPasswordHash, userId).run();

    return c.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json({ error: 'Failed to change password' }, 500);
  }
});

export default auth;

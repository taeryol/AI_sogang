// Admin management routes

import { Hono } from 'hono';
import { Bindings, Variables } from '../types/bindings';
import { verifyAuth, requireAdmin } from '../middleware/auth';

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * GET /api/admin/users
 * Get all users (admin only)
 */
admin.get('/users', verifyAuth, requireAdmin, async (c) => {
  try {
    const result = await c.env.DB.prepare(
      `SELECT id, email, name, role, created_at, updated_at 
       FROM users 
       ORDER BY created_at DESC`
    ).all();

    return c.json({
      users: result.results || []
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

/**
 * PUT /api/admin/users/:id/role
 * Update user role (admin only)
 */
admin.put('/users/:id/role', verifyAuth, requireAdmin, async (c) => {
  try {
    const userId = parseInt(c.req.param('id'));
    const adminId = c.get('userId');
    const { role } = await c.req.json();

    if (!role || (role !== 'user' && role !== 'admin')) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // Prevent admin from demoting themselves
    if (userId === adminId) {
      return c.json({ error: 'Cannot change your own role' }, 400);
    }

    // Update role
    await c.env.DB.prepare(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(role, userId).run();

    // Log action
    await c.env.DB.prepare(
      'INSERT INTO user_audit_log (user_id, action, details, performed_by) VALUES (?, ?, ?, ?)'
    ).bind(userId, 'role_change', `Changed role to ${role}`, adminId).run();

    return c.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Error updating role:', error);
    return c.json({ error: 'Failed to update role' }, 500);
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user (admin only)
 */
admin.delete('/users/:id', verifyAuth, requireAdmin, async (c) => {
  try {
    const userId = parseInt(c.req.param('id'));
    const adminId = c.get('userId');

    // Prevent admin from deleting themselves
    if (userId === adminId) {
      return c.json({ error: 'Cannot delete your own account' }, 400);
    }

    // Check if user exists
    const user = await c.env.DB.prepare(
      'SELECT id, email FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Log action before deletion
    await c.env.DB.prepare(
      'INSERT INTO user_audit_log (user_id, action, details, performed_by) VALUES (?, ?, ?, ?)'
    ).bind(userId, 'user_deleted', `Deleted user ${user.email}`, adminId).run();

    // Delete user
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

    return c.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

/**
 * GET /api/admin/settings
 * Get all API settings (admin only)
 */
admin.get('/settings', verifyAuth, requireAdmin, async (c) => {
  try {
    const result = await c.env.DB.prepare(
      `SELECT setting_key, setting_value, encrypted, updated_at 
       FROM api_settings 
       ORDER BY setting_key`
    ).all();

    // Mask encrypted values
    const settings = (result.results || []).map((setting: any) => ({
      ...setting,
      setting_value: setting.encrypted ? '********' : setting.setting_value
    }));

    return c.json({ settings });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return c.json({ error: 'Failed to fetch settings' }, 500);
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update API setting (admin only)
 */
admin.put('/settings/:key', verifyAuth, requireAdmin, async (c) => {
  try {
    const settingKey = c.req.param('key');
    const adminId = c.get('userId');
    const body = await c.req.json();
    const value = body.value;

    console.log('[Admin] Updating setting:', { settingKey, hasValue: !!value, valueLength: value?.length });

    // Allow empty values to clear settings
    if (value === undefined || value === null) {
      return c.json({ error: 'Value is required' }, 400);
    }

    // Update or insert setting
    await c.env.DB.prepare(
      `INSERT INTO api_settings (setting_key, setting_value, updated_by, encrypted) 
       VALUES (?, ?, ?, 0)
       ON CONFLICT(setting_key) 
       DO UPDATE SET setting_value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP`
    ).bind(settingKey, value, adminId, value, adminId).run();

    console.log('[Admin] Setting updated successfully:', settingKey);
    return c.json({ message: 'Setting updated successfully' });
  } catch (error) {
    console.error('Error updating setting:', error);
    return c.json({ error: 'Failed to update setting' }, 500);
  }
});

/**
 * GET /api/admin/stats
 * Get system statistics (admin only)
 */
admin.get('/stats', verifyAuth, requireAdmin, async (c) => {
  try {
    // Get user count
    const userCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).first();

    // Get document count
    const docCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM documents'
    ).first();

    // Get query count
    const queryCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM queries'
    ).first();

    // Get average response time
    const avgResponse = await c.env.DB.prepare(
      'SELECT AVG(response_time_ms) as avg FROM queries WHERE status = "success"'
    ).first();

    // Get recent queries
    const recentQueries = await c.env.DB.prepare(
      `SELECT q.id, q.question, q.status, q.response_time_ms, q.created_at, u.name as user_name
       FROM queries q
       JOIN users u ON q.user_id = u.id
       ORDER BY q.created_at DESC
       LIMIT 10`
    ).all();

    return c.json({
      stats: {
        total_users: userCount?.count || 0,
        total_documents: docCount?.count || 0,
        total_queries: queryCount?.count || 0,
        avg_response_time: avgResponse?.avg ? Math.round(avgResponse.avg) : 0
      },
      recent_queries: recentQueries.results || []
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

/**
 * GET /api/admin/audit-log
 * Get user audit log (admin only)
 */
admin.get('/audit-log', verifyAuth, requireAdmin, async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');

    const result = await c.env.DB.prepare(
      `SELECT 
        al.id, al.action, al.details, al.created_at,
        u1.name as user_name, u1.email as user_email,
        u2.name as performed_by_name
       FROM user_audit_log al
       JOIN users u1 ON al.user_id = u1.id
       JOIN users u2 ON al.performed_by = u2.id
       ORDER BY al.created_at DESC
       LIMIT ?`
    ).bind(limit).all();

    return c.json({
      logs: result.results || []
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return c.json({ error: 'Failed to fetch audit log' }, 500);
  }
});

/**
 * POST /api/admin/verify-code
 * Verify admin registration code
 */
admin.post('/verify-code', async (c) => {
  try {
    const { code } = await c.req.json();

    if (!code) {
      return c.json({ error: 'Code is required' }, 400);
    }

    // Check if code exists and is unused
    const adminCode = await c.env.DB.prepare(
      'SELECT id, is_used FROM admin_codes WHERE code = ?'
    ).bind(code).first();

    if (!adminCode) {
      return c.json({ error: 'Invalid code' }, 404);
    }

    if (adminCode.is_used) {
      return c.json({ error: 'Code already used' }, 400);
    }

    return c.json({ 
      valid: true,
      message: 'Code is valid' 
    });
  } catch (error) {
    console.error('Error verifying code:', error);
    return c.json({ error: 'Failed to verify code' }, 500);
  }
});

/**
 * POST /api/admin/generate-code
 * Generate new admin registration code (admin only)
 */
admin.post('/generate-code', verifyAuth, requireAdmin, async (c) => {
  try {
    const adminId = c.get('userId');
    
    // Generate random code
    const code = 'ADMIN-' + crypto.randomUUID().split('-')[0].toUpperCase();

    // Insert code
    await c.env.DB.prepare(
      'INSERT INTO admin_codes (code, created_by) VALUES (?, ?)'
    ).bind(code, adminId).run();

    return c.json({ 
      code,
      message: 'Admin code generated successfully' 
    });
  } catch (error) {
    console.error('Error generating code:', error);
    return c.json({ error: 'Failed to generate code' }, 500);
  }
});

/**
 * POST /api/admin/test-openai
 * Test OpenAI API key (admin only)
 */
admin.post('/test-openai', verifyAuth, requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const apiKey = body.apiKey?.trim();

    if (!apiKey) {
      return c.json({ error: 'API key is required' }, 400);
    }

    console.log('[Admin] Testing OpenAI API key:', apiKey.substring(0, 7) + '...');

    // Test with a simple completion request
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Say "API key test successful"' }
        ],
        max_tokens: 10
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Admin] OpenAI API test failed:', errorData);
      
      let errorMessage = 'API key is invalid';
      if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
      
      return c.json({ 
        success: false,
        error: errorMessage
      }, 400);
    }

    const result = await response.json();
    console.log('[Admin] OpenAI API test successful');

    return c.json({ 
      success: true,
      model: result.model || 'gpt-3.5-turbo',
      message: 'API key is valid and working!'
    });
  } catch (error) {
    console.error('[Admin] OpenAI test error:', error);
    return c.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

/**
 * POST /api/admin/test-llamaparse
 * Test LlamaParse API key (admin only)
 */
admin.post('/test-llamaparse', verifyAuth, requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const apiKey = body.apiKey?.trim();

    if (!apiKey) {
      return c.json({ error: 'API key is required' }, 400);
    }

    console.log('[Admin] Testing LlamaParse API key:', apiKey.substring(0, 4) + '...');

    // Create a test file
    const testContent = 'LlamaParse API Test Document';
    const blob = new Blob([testContent], { type: 'text/plain' });
    
    // Step 1: Upload test file
    const formData = new FormData();
    formData.append('file', blob, 'test.txt');

    const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[Admin] LlamaParse upload failed:', errorText);
      return c.json({ 
        success: false,
        error: `Upload failed (${uploadResponse.status}): ${errorText}` 
      }, 400);
    }

    const uploadResult = await uploadResponse.json();
    const jobId = uploadResult.id;
    
    console.log('[Admin] LlamaParse job created:', jobId);

    // Step 2: Check job status (wait max 10 seconds)
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(
        `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error('[Admin] Status check failed:', errorText);
        return c.json({ 
          success: false,
          error: `Status check failed (${statusResponse.status})` 
        }, 400);
      }

      const statusResult = await statusResponse.json();
      console.log('[Admin] Job status:', statusResult.status);
      
      if (statusResult.status === 'SUCCESS') {
        console.log('[Admin] LlamaParse test successful');
        return c.json({ 
          success: true,
          jobId,
          message: 'API key is valid and working!'
        });
      } else if (statusResult.status === 'ERROR') {
        console.error('[Admin] Parsing error:', statusResult.error);
        return c.json({ 
          success: false,
          error: statusResult.error || 'Parsing failed' 
        }, 400);
      }
      
      attempts++;
    }

    // Job created but timed out
    console.log('[Admin] LlamaParse test timed out but job was created');
    return c.json({ 
      success: true,
      jobId,
      message: 'API key is valid (job created successfully)'
    });
  } catch (error) {
    console.error('[Admin] LlamaParse test error:', error);
    return c.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

export default admin;

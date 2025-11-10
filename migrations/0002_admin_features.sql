-- API Settings table
CREATE TABLE IF NOT EXISTS api_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  encrypted INTEGER DEFAULT 0,
  updated_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Admin access codes for first-time admin registration
CREATE TABLE IF NOT EXISTS admin_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  is_used INTEGER DEFAULT 0,
  used_by INTEGER,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME,
  FOREIGN KEY (used_by) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- User permissions audit log
CREATE TABLE IF NOT EXISTS user_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  performed_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_settings_key ON api_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_admin_codes_code ON admin_codes(code);
CREATE INDEX IF NOT EXISTS idx_admin_codes_used ON admin_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_user_id ON user_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_created_at ON user_audit_log(created_at);

-- Note: Default admin code and API settings will be inserted after first user is created
-- See seed-production.sql for initial data setup

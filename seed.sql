-- Insert test admin user
-- Password: admin123 (in production, this should be properly hashed)
INSERT OR IGNORE INTO users (id, email, name, password_hash, role) VALUES 
  (1, 'admin@company.com', 'Admin User', '$2a$10$YourHashedPasswordHere', 'admin');

-- Insert test regular user
INSERT OR IGNORE INTO users (id, email, name, password_hash, role) VALUES 
  (2, 'user@company.com', 'Regular User', '$2a$10$YourHashedPasswordHere', 'user');

-- Note: In production, passwords should be hashed using bcrypt or similar
-- The above are placeholder hashes for development only

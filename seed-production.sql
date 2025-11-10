-- Production initial data setup
-- This script should be run after first deployment

-- Insert initial admin user (password: admin123)
INSERT INTO users (id, email, name, password_hash, role) VALUES
(1, 'admin@company.com', 'System Admin', '8c5f7d2a-3b4e-4f8a-9d6c-1e2f3a4b5c6d:8f3e4d5c6b7a8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f', 'admin');

-- Insert default admin code for new registrations
INSERT INTO admin_codes (code, created_by) VALUES
('ADMIN-SETUP-2025', 1);

-- Insert default API settings (empty values, to be configured in admin panel)
INSERT INTO api_settings (setting_key, setting_value, encrypted, updated_by) VALUES
('openai_api_key', '', 1, 1),
('openai_model', 'gpt-4', 0, 1),
('embedding_model', 'text-embedding-3-small', 0, 1),
('vector_db_type', 'simple', 0, 1),
('pinecone_api_key', '', 1, 1),
('pinecone_environment', '', 0, 1),
('pinecone_index', 'kms-embeddings', 0, 1),
('system_initialized', 'false', 0, 1);

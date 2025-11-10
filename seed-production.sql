-- Production initial data setup
-- This script should be run after first deployment

-- Insert initial admin user (password: admin123)
INSERT INTO users (id, email, name, password_hash, role) VALUES
(1, 'admin@company.com', 'System Admin', '0348ec58-b320-4485-810b-872f60b08aa4:0ade159ea43990e8a0573c9461e237cf5bbb3d41c7697ae8c1c1d4525d23bdbf', 'admin');

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

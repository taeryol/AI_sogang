-- Add parsing API keys to api_settings table
-- Supports LlamaParse and PDF.co for document parsing

-- No table changes needed, just insert default entries
-- api_settings table already exists from 0002_admin_features.sql

-- Note: We'll insert these through the admin panel instead of migration
-- This avoids foreign key constraint issues
-- The admin panel will handle the updated_by field properly

-- Add file_content column to store document content directly in D1
-- This allows us to avoid R2 dependency for Cloudflare Pages deployment

-- Add file_content column (TEXT can store up to ~1GB in SQLite)
ALTER TABLE documents ADD COLUMN file_content TEXT;

-- Make r2_key nullable for backward compatibility
-- Note: SQLite doesn't support ALTER COLUMN, so we create a new table and migrate data

-- Create new documents table with updated schema
CREATE TABLE IF NOT EXISTS documents_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  r2_key TEXT,  -- Now optional (no UNIQUE, no NOT NULL)
  file_content TEXT,  -- New: store file content directly
  uploaded_by INTEGER NOT NULL,
  status TEXT DEFAULT 'processing' CHECK(status IN ('processing', 'indexed', 'failed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Copy existing data
INSERT INTO documents_new (id, title, filename, file_size, file_type, r2_key, uploaded_by, status, created_at, updated_at)
SELECT id, title, filename, file_size, file_type, r2_key, uploaded_by, status, created_at, updated_at
FROM documents;

-- Drop old table
DROP TABLE documents;

-- Rename new table
ALTER TABLE documents_new RENAME TO documents;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- Add conversation session support to queries table

-- Add session_id column to group related conversations
ALTER TABLE queries ADD COLUMN session_id TEXT;

-- Add parent_query_id for follow-up questions
ALTER TABLE queries ADD COLUMN parent_query_id INTEGER;

-- Create index for faster session queries
CREATE INDEX IF NOT EXISTS idx_queries_session ON queries(session_id);
CREATE INDEX IF NOT EXISTS idx_queries_parent ON queries(parent_query_id);

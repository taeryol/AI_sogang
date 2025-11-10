// Database models

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: number;
  title: string;
  filename: string;
  file_size: number;
  file_type: string;
  r2_key: string;
  uploaded_by: number;
  status: 'processing' | 'indexed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: number;
  document_id: number;
  content: string;
  chunk_index: number;
  embedding_id: string | null;
  metadata: string | null;
  created_at: string;
}

export interface Query {
  id: number;
  user_id: number;
  question: string;
  answer: string | null;
  sources: string | null;
  response_time_ms: number | null;
  status: 'success' | 'failed';
  created_at: string;
}

export interface Feedback {
  id: number;
  query_id: number;
  user_id: number;
  rating: 1 | -1;
  comment: string | null;
  created_at: string;
}

// API request/response types

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

export interface QueryRequest {
  question: string;
}

export interface QueryResponse {
  answer: string;
  sources: Array<{
    document_id: number;
    title: string;
    chunk_content: string;
  }>;
  response_time_ms: number;
}

export interface FeedbackRequest {
  query_id: number;
  rating: 1 | -1;
  comment?: string;
}

export interface DocumentUploadResponse {
  id: number;
  title: string;
  filename: string;
  status: string;
}

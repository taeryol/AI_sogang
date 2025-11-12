// Cloudflare bindings type definitions

import { VectorizeIndex } from '../services/vectordb';

export type Bindings = {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  // R2 bucket removed - storing files directly in D1 instead
  OPENAI_API_KEY?: string;
  PINECONE_API_KEY?: string;
  PINECONE_ENVIRONMENT?: string;
  PINECONE_INDEX?: string;
  JWT_SECRET?: string;
  SESSION_SECRET?: string;
}

export type Variables = {
  userId?: number;
  userRole?: 'user' | 'admin';
}

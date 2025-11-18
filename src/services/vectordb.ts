// Vector database implementations for MindBase
// Supports: Cloudflare Vectorize, Pinecone, and in-memory storage

export interface VectorDocument {
  id: string;
  embedding: number[];
  metadata: {
    document_id: number;
    chunk_id: number;
    chunk_index: number;
    content: string;
    title: string;
  };
}

export interface VectorizeIndex {
  query(vector: number[], options: { topK: number; returnValues?: boolean; returnMetadata?: boolean }): Promise<{
    matches: Array<{
      id: string;
      score: number;
      values?: number[];
      metadata?: Record<string, any>;
    }>;
  }>;
  insert(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, any> }>): Promise<{ count: number }>;
  upsert(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, any> }>): Promise<{ count: number }>;
  deleteByIds(ids: string[]): Promise<{ count: number }>;
  getByIds(ids: string[]): Promise<Array<{ id: string; values: number[]; metadata?: Record<string, any> }>>;
}

export class SimpleVectorDB {
  private vectors: VectorDocument[] = [];

  /**
   * Add a vector document to the database
   */
  async upsert(doc: VectorDocument): Promise<void> {
    const existingIndex = this.vectors.findIndex(v => v.id === doc.id);
    if (existingIndex >= 0) {
      this.vectors[existingIndex] = doc;
    } else {
      this.vectors.push(doc);
    }
  }

  /**
   * Batch upsert multiple vector documents
   */
  async batchUpsert(docs: VectorDocument[]): Promise<void> {
    for (const doc of docs) {
      await this.upsert(doc);
    }
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async search(queryEmbedding: number[], topK: number = 5): Promise<VectorDocument[]> {
    const results = this.vectors
      .map(doc => ({
        doc,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(result => result.doc);

    return results;
  }

  /**
   * Delete vectors by document_id
   */
  async deleteByDocumentId(documentId: number): Promise<void> {
    this.vectors = this.vectors.filter(v => v.metadata.document_id !== documentId);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get total number of vectors
   */
  size(): number {
    return this.vectors.length;
  }

  /**
   * Clear all vectors
   */
  clear(): void {
    this.vectors = [];
  }
}

// Cloudflare Vectorize integration (recommended for production)
export class CloudflareVectorize {
  private index: VectorizeIndex;

  constructor(index: VectorizeIndex) {
    this.index = index;
  }

  /**
   * Add a vector document to Vectorize
   */
  async upsert(doc: VectorDocument): Promise<void> {
    await this.batchUpsert([doc]);
  }

  /**
   * Batch upsert multiple vector documents
   */
  async batchUpsert(docs: VectorDocument[]): Promise<void> {
    try {
      const vectors = docs.map(doc => ({
        id: doc.id,
        values: doc.embedding,
        metadata: {
          document_id: doc.metadata.document_id,
          chunk_id: doc.metadata.chunk_id,
          content: doc.metadata.content,
          title: doc.metadata.title
        }
      }));

      const result = await this.index.upsert(vectors);
      console.log(`[Vectorize] Upserted ${result.count} vectors`);
    } catch (error) {
      console.error('[Vectorize] Error upserting:', error);
      throw error;
    }
  }

  /**
   * Search for similar vectors
   */
  async search(queryEmbedding: number[], topK: number = 5): Promise<VectorDocument[]> {
    try {
      const result = await this.index.query(queryEmbedding, {
        topK,
        returnValues: true,
        returnMetadata: true
      });

      return result.matches.map(match => ({
        id: match.id,
        embedding: match.values || [],
        metadata: {
          document_id: match.metadata?.document_id || 0,
          chunk_id: match.metadata?.chunk_id || 0,
          content: match.metadata?.content || '',
          title: match.metadata?.title || ''
        }
      }));
    } catch (error) {
      console.error('[Vectorize] Error searching:', error);
      throw error;
    }
  }

  /**
   * Delete vectors by document_id
   * Note: Vectorize doesn't support metadata filtering for deletion yet,
   * so we need to get all vectors and filter manually
   */
  async deleteByDocumentId(documentId: number): Promise<void> {
    try {
      // This is a workaround - in a real implementation, you'd want to:
      // 1. Keep track of vector IDs in D1
      // 2. Query D1 for all chunk IDs belonging to this document
      // 3. Delete by those specific IDs
      console.log(`[Vectorize] Delete by document_id not directly supported. Consider storing vector IDs in D1.`);
      
      // For now, we'll log this - you should implement proper tracking in D1
      console.warn(`[Vectorize] TODO: Implement proper deletion tracking for document ${documentId}`);
    } catch (error) {
      console.error('[Vectorize] Error deleting:', error);
      throw error;
    }
  }

  /**
   * Delete specific vector IDs
   */
  async deleteByIds(ids: string[]): Promise<void> {
    try {
      const result = await this.index.deleteByIds(ids);
      console.log(`[Vectorize] Deleted ${result.count} vectors`);
    } catch (error) {
      console.error('[Vectorize] Error deleting by IDs:', error);
      throw error;
    }
  }

  /**
   * Get vectors by IDs
   */
  async getByIds(ids: string[]): Promise<VectorDocument[]> {
    try {
      const vectors = await this.index.getByIds(ids);
      return vectors.map(v => ({
        id: v.id,
        embedding: v.values,
        metadata: {
          document_id: v.metadata?.document_id || 0,
          chunk_id: v.metadata?.chunk_id || 0,
          content: v.metadata?.content || '',
          title: v.metadata?.title || ''
        }
      }));
    } catch (error) {
      console.error('[Vectorize] Error getting by IDs:', error);
      throw error;
    }
  }
}

// Pinecone integration (for production use)
export class PineconeVectorDB {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, indexHost: string) {
    this.apiKey = apiKey;
    this.baseUrl = `https://${indexHost}`;
  }

  async upsert(doc: VectorDocument): Promise<void> {
    await this.batchUpsert([doc]);
  }

  async batchUpsert(docs: VectorDocument[]): Promise<void> {
    try {
      const vectors = docs.map(doc => ({
        id: doc.id,
        values: doc.embedding,
        metadata: doc.metadata
      }));

      const response = await fetch(`${this.baseUrl}/vectors/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.apiKey
        },
        body: JSON.stringify({
          vectors,
          namespace: ''
        })
      });

      if (!response.ok) {
        throw new Error(`Pinecone API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error upserting to Pinecone:', error);
      throw error;
    }
  }

  async search(queryEmbedding: number[], topK: number = 5): Promise<VectorDocument[]> {
    try {
      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.apiKey
        },
        body: JSON.stringify({
          vector: queryEmbedding,
          topK,
          includeMetadata: true,
          namespace: ''
        })
      });

      if (!response.ok) {
        throw new Error(`Pinecone API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.matches.map((match: any) => ({
        id: match.id,
        embedding: match.values || [],
        metadata: match.metadata
      }));
    } catch (error) {
      console.error('Error searching Pinecone:', error);
      throw error;
    }
  }

  async deleteByDocumentId(documentId: number): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/vectors/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': this.apiKey
        },
        body: JSON.stringify({
          filter: {
            'metadata.document_id': documentId
          },
          namespace: ''
        })
      });

      if (!response.ok) {
        throw new Error(`Pinecone API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error deleting from Pinecone:', error);
      throw error;
    }
  }
}

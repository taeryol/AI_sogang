// Simple in-memory vector database for development
// In production, replace with Pinecone, Weaviate, or Cloudflare Vectorize

export interface VectorDocument {
  id: string;
  embedding: number[];
  metadata: {
    document_id: number;
    chunk_id: number;
    content: string;
    title: string;
  };
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

// Pinecone integration (for production use)
export class PineconeVectorDB {
  private apiKey: string;
  private environment: string;
  private indexName: string;
  private baseUrl: string;

  constructor(apiKey: string, environment: string, indexName: string) {
    this.apiKey = apiKey;
    this.environment = environment;
    this.indexName = indexName;
    this.baseUrl = `https://${indexName}-${environment}.svc.pinecone.io`;
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

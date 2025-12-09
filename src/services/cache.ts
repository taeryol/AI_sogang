// Caching service for embeddings and search results

/**
 * Generate cache key from text using simple hash
 */
export function generateCacheKey(prefix: string, text: string): string {
  // Simple hash function for cache key
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${prefix}:${Math.abs(hash).toString(36)}:${text.length}`;
}

/**
 * Cache embedding with TTL
 */
export async function cacheEmbedding(
  kv: KVNamespace,
  text: string,
  embedding: number[]
): Promise<void> {
  try {
    const key = generateCacheKey('embedding', text);
    // Store as JSON string, TTL 24 hours (86400 seconds)
    await kv.put(key, JSON.stringify(embedding), {
      expirationTtl: 86400
    });
    console.log(`[Cache] Embedding cached: ${key}`);
  } catch (error) {
    console.error('[Cache] Failed to cache embedding:', error);
  }
}

/**
 * Get cached embedding
 */
export async function getCachedEmbedding(
  kv: KVNamespace,
  text: string
): Promise<number[] | null> {
  try {
    const key = generateCacheKey('embedding', text);
    const cached = await kv.get(key);
    
    if (cached) {
      console.log(`[Cache] Embedding cache HIT: ${key}`);
      return JSON.parse(cached);
    }
    
    console.log(`[Cache] Embedding cache MISS: ${key}`);
    return null;
  } catch (error) {
    console.error('[Cache] Failed to get cached embedding:', error);
    return null;
  }
}

/**
 * Cache search results with TTL
 */
export async function cacheSearchResults(
  kv: KVNamespace,
  queryText: string,
  results: any[]
): Promise<void> {
  try {
    const key = generateCacheKey('search', queryText);
    // Store as JSON string, TTL 1 hour (3600 seconds)
    await kv.put(key, JSON.stringify(results), {
      expirationTtl: 3600
    });
    console.log(`[Cache] Search results cached: ${key}`);
  } catch (error) {
    console.error('[Cache] Failed to cache search results:', error);
  }
}

/**
 * Get cached search results
 */
export async function getCachedSearchResults(
  kv: KVNamespace,
  queryText: string
): Promise<any[] | null> {
  try {
    const key = generateCacheKey('search', queryText);
    const cached = await kv.get(key);
    
    if (cached) {
      console.log(`[Cache] Search cache HIT: ${key}`);
      return JSON.parse(cached);
    }
    
    console.log(`[Cache] Search cache MISS: ${key}`);
    return null;
  } catch (error) {
    console.error('[Cache] Failed to get cached search results:', error);
    return null;
  }
}

/**
 * Invalidate cache for a specific document
 * Call this when a document is updated or deleted
 */
export async function invalidateDocumentCache(
  kv: KVNamespace,
  documentId: number
): Promise<void> {
  try {
    // KV doesn't support prefix deletion, so we'll use a version marker
    const versionKey = `doc_version:${documentId}`;
    const currentVersion = await kv.get(versionKey) || '0';
    const newVersion = (parseInt(currentVersion) + 1).toString();
    await kv.put(versionKey, newVersion);
    
    console.log(`[Cache] Invalidated cache for document ${documentId}, version: ${newVersion}`);
  } catch (error) {
    console.error('[Cache] Failed to invalidate document cache:', error);
  }
}

/**
 * Get cache statistics (for monitoring)
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// In-memory stats (resets on worker restart)
const stats = {
  hits: 0,
  misses: 0
};

export function recordCacheHit(): void {
  stats.hits++;
}

export function recordCacheMiss(): void {
  stats.misses++;
}

export function getCacheStats(): CacheStats {
  const total = stats.hits + stats.misses;
  return {
    hits: stats.hits,
    misses: stats.misses,
    hitRate: total > 0 ? stats.hits / total : 0
  };
}

export function resetCacheStats(): void {
  stats.hits = 0;
  stats.misses = 0;
}

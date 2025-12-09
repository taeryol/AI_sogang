// Contextual Chunk Selection - retrieve surrounding chunks for better context

/**
 * Get contextual chunks (N-1, N, N+1) for better answer generation
 */
export async function getContextualChunks(
  db: D1Database,
  selectedChunks: Array<{ document_id: number; chunk_index: number; chunk_id: number }>
): Promise<Map<number, any>> {
  const contextualChunks = new Map<number, any>();
  
  try {
    // For each selected chunk, get adjacent chunks
    for (const chunk of selectedChunks) {
      const { document_id, chunk_index } = chunk;
      
      // Get current chunk and adjacent chunks (N-1, N, N+1)
      const adjacentIndices = [
        Math.max(0, chunk_index - 1), // Previous chunk (N-1)
        chunk_index,                   // Current chunk (N)
        chunk_index + 1                // Next chunk (N+1)
      ];
      
      // Query for chunks in this range
      const result = await db.prepare(
        `SELECT id, document_id, content, chunk_index, embedding_id
         FROM document_chunks
         WHERE document_id = ? AND chunk_index IN (?, ?, ?)
         ORDER BY chunk_index ASC`
      ).bind(document_id, ...adjacentIndices).all();
      
      // Add to contextual chunks map
      if (result.results) {
        for (const dbChunk of result.results) {
          if (!contextualChunks.has(dbChunk.id as number)) {
            contextualChunks.set(dbChunk.id as number, {
              chunk_id: dbChunk.id,
              document_id: dbChunk.document_id,
              chunk_index: dbChunk.chunk_index,
              content: dbChunk.content,
              embedding_id: dbChunk.embedding_id,
              is_primary: dbChunk.chunk_index === chunk_index
            });
          }
        }
      }
    }
    
    console.log(`[ContextualChunks] Expanded ${selectedChunks.length} chunks to ${contextualChunks.size} with context`);
  } catch (error) {
    console.error('[ContextualChunks] Error fetching contextual chunks:', error);
  }
  
  return contextualChunks;
}

/**
 * Group chunks by document and merge adjacent chunks for better context
 */
export function groupAndMergeChunks(chunks: any[]): Array<{
  document_id: number;
  title: string;
  chunk_indices: number[];
  merged_content: string;
  is_primary: boolean;
}> {
  // Group by document_id
  const documentGroups = new Map<number, any[]>();
  
  for (const chunk of chunks) {
    if (!documentGroups.has(chunk.document_id)) {
      documentGroups.set(chunk.document_id, []);
    }
    documentGroups.get(chunk.document_id)!.push(chunk);
  }
  
  // Merge adjacent chunks within each document
  const mergedGroups: Array<any> = [];
  
  for (const [documentId, docChunks] of documentGroups.entries()) {
    // Sort by chunk_index
    docChunks.sort((a, b) => a.chunk_index - b.chunk_index);
    
    // Find primary (originally selected) chunks
    const primaryChunks = docChunks.filter(c => c.is_primary);
    
    // Group consecutive chunks
    const groups: any[][] = [];
    let currentGroup: any[] = [docChunks[0]];
    
    for (let i = 1; i < docChunks.length; i++) {
      const prev = docChunks[i - 1];
      const curr = docChunks[i];
      
      // If consecutive, add to current group
      if (curr.chunk_index === prev.chunk_index + 1) {
        currentGroup.push(curr);
      } else {
        // Start new group
        groups.push(currentGroup);
        currentGroup = [curr];
      }
    }
    groups.push(currentGroup);
    
    // Merge each group
    for (const group of groups) {
      const hasPrimary = group.some(c => c.is_primary);
      
      mergedGroups.push({
        document_id: documentId,
        title: group[0].title || 'Unknown',
        chunk_indices: group.map(c => c.chunk_index),
        merged_content: group.map(c => c.content).join('\n\n'),
        is_primary: hasPrimary
      });
    }
  }
  
  // Sort by primary first, then by document_id
  mergedGroups.sort((a, b) => {
    if (a.is_primary !== b.is_primary) {
      return a.is_primary ? -1 : 1;
    }
    return a.document_id - b.document_id;
  });
  
  console.log(`[ContextualChunks] Merged ${chunks.length} chunks into ${mergedGroups.length} contextual groups`);
  
  return mergedGroups;
}

/**
 * Calculate optimal context window size based on chunk count
 */
export function getOptimalContextWindow(chunkCount: number): number {
  // If we have few chunks, include more context
  if (chunkCount <= 3) return 1; // Include N-1 and N+1
  if (chunkCount <= 5) return 1; // Standard context
  return 0; // No additional context if we have many chunks
}

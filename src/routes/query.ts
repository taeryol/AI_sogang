// Q&A query routes

import { Hono } from 'hono';
import { Bindings, Variables } from '../types/bindings';
import { verifyAuth } from '../middleware/auth';
import { OpenAIService } from '../services/openai';
import { PineconeVectorDB } from '../services/vectordb';
import { DocumentProcessor } from '../services/document-processor';
import { QueryRequest, QueryResponse } from '../types/models';
import { 
  getCachedEmbedding, 
  cacheEmbedding, 
  recordCacheHit, 
  recordCacheMiss 
} from '../services/cache';
import { getContextualChunks, groupAndMergeChunks } from '../services/chunk-context';

const query = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * POST /api/query
 * Ask a question and get AI-generated answer
 */
query.post('/', verifyAuth, async (c) => {
  const startTime = Date.now();
  
  try {
    const userId = c.get('userId');
    const body: QueryRequest = await c.req.json();
    const { question, session_id, parent_query_id } = body;

    if (!question || question.trim().length === 0) {
      return c.json({ error: 'Question is required' }, 400);
    }

    // Generate or use provided session_id
    const currentSessionId = session_id || `session_${Date.now()}_${userId}`;

    // Get conversation history if this is a follow-up question
    let conversationContext = '';
    if (parent_query_id) {
      const history = await c.env.DB.prepare(
        `SELECT question, answer FROM queries 
         WHERE id = ? AND user_id = ? AND status = 'success'`
      ).bind(parent_query_id, userId).first<{ question: string; answer: string }>();
      
      if (history) {
        conversationContext = `이전 대화:
Q: ${history.question}
A: ${history.answer}

현재 질문: ${question}

위 대화를 참고하여 현재 질문에 답변해주세요.`;
      }
    } else if (session_id) {
      // Get recent conversation in this session
      const recentHistory = await c.env.DB.prepare(
        `SELECT question, answer FROM queries 
         WHERE session_id = ? AND user_id = ? AND status = 'success'
         ORDER BY created_at DESC LIMIT 3`
      ).bind(session_id, userId).all();
      
      if (recentHistory.results && recentHistory.results.length > 0) {
        const historyText = recentHistory.results.reverse().map((h: any) => 
          `Q: ${h.question}\nA: ${h.answer}`
        ).join('\n\n');
        conversationContext = `대화 히스토리:
${historyText}

현재 질문: ${question}

위 대화를 참고하여 답변해주세요.`;
      }
    }

    // Load API settings from database
    const apiKeyResult = await c.env.DB.prepare(
      'SELECT setting_value FROM api_settings WHERE setting_key = ?'
    ).bind('openai_api_key').first<{ setting_value: string }>();

    if (!apiKeyResult || !apiKeyResult.setting_value) {
      return c.json({ 
        error: 'OpenAI API 키가 설정되지 않았습니다. 관리자 페이지에서 API 설정을 완료해주세요.',
        code: 'NO_API_KEY'
      }, 400);
    }

    const apiKey = apiKeyResult.setting_value;

    // Initialize OpenAI service
    const openai = new OpenAIService(apiKey);

    // Step 1: Reformulate query for better search (with conversation context)
    console.log(`[Query] Original question: "${question}"`);
    console.log(`[Query] Has conversation context: ${!!conversationContext}`);
    const questionToReformulate = conversationContext || question;
    const reformulatedQuery = await openai.reformulateQuery(questionToReformulate);
    console.log(`[Query] Reformulated query: "${reformulatedQuery}"`);

    // Step 2: Generate embedding for the reformulated question (with caching)
    let questionEmbedding = await getCachedEmbedding(c.env.CACHE, reformulatedQuery);
    
    if (questionEmbedding) {
      recordCacheHit();
      console.log('[Query] Using cached embedding');
    } else {
      recordCacheMiss();
      console.log('[Query] Generating new embedding');
      questionEmbedding = await openai.generateEmbedding(reformulatedQuery);
      // Cache for future use
      await cacheEmbedding(c.env.CACHE, reformulatedQuery, questionEmbedding);
    }

    // Step 3: Vector search for similar document chunks using Pinecone
    const pineconeKeyResult = await c.env.DB.prepare(
      'SELECT setting_value FROM api_settings WHERE setting_key = ?'
    ).bind('pinecone_api_key').first<{ setting_value: string }>();

    let vectorResults: any[] = [];
    if (pineconeKeyResult?.setting_value) {
      const pinecone = new PineconeVectorDB(
        pineconeKeyResult.setting_value,
        'mindbase-vectors-5mchy92.svc.aped-4627-b74a.pinecone.io'
      );
      vectorResults = await pinecone.search(questionEmbedding, 5);
    }

    // Step 4: Keyword search for additional context (using reformulated query)
    const keywordResults = await performKeywordSearch(c.env.DB, reformulatedQuery, 5);

    // Step 5: Combine and deduplicate results
    const allChunks = new Map<number, any>();
    
    vectorResults.forEach(result => {
      if (!allChunks.has(result.metadata.chunk_id)) {
        allChunks.set(result.metadata.chunk_id, {
          ...result.metadata,
          is_primary: true  // Mark as primary selected chunk
        });
      }
    });

    keywordResults.forEach(result => {
      if (!allChunks.has(result.id)) {
        allChunks.set(result.id, {
          chunk_id: result.id,
          document_id: result.document_id,
          chunk_index: result.chunk_index || 0,
          content: result.content,
          title: result.title || 'Unknown',
          is_primary: true  // Mark as primary selected chunk
        });
      }
    });

    // Step 5.5: Get contextual chunks (N-1, N, N+1) for better context
    const primaryChunks = Array.from(allChunks.values()).slice(0, 5);
    const contextualChunksMap = await getContextualChunks(
      c.env.DB,
      primaryChunks.map(c => ({
        document_id: c.document_id,
        chunk_index: c.chunk_index,
        chunk_id: c.chunk_id
      }))
    );
    
    // Add title to contextual chunks
    for (const [chunkId, chunk] of contextualChunksMap.entries()) {
      const primaryChunk = primaryChunks.find(c => c.document_id === chunk.document_id);
      if (primaryChunk) {
        chunk.title = primaryChunk.title;
      }
    }
    
    // Merge adjacent chunks for coherent context
    const mergedChunks = groupAndMergeChunks(Array.from(contextualChunksMap.values()));

    // Step 6: Prepare contexts with source information
    const chunksArray = mergedChunks.slice(0, 5);
    
    if (chunksArray.length === 0) {
      // No relevant information found
      const noResultAnswer = `죄송합니다. 질문하신 내용과 관련된 문서를 찾을 수 없습니다. 😊

📝 다음을 시도해보세요:
• 다른 키워드로 질문하기
• 관련 문서를 먼저 업로드하기 (상단 "문서 관리" 메뉴)
• 더 구체적인 질문하기

💡 팁: 시스템에 업로드된 문서가 ${await getDocumentCount(c.env.DB)}개 있습니다.`;
      
      // Log the query
      await c.env.DB.prepare(
        `INSERT INTO queries (user_id, question, answer, status, response_time_ms)
         VALUES (?, ?, ?, 'success', ?)`
      ).bind(userId, question, noResultAnswer, Date.now() - startTime).run();

      return c.json({
        answer: noResultAnswer,
        sources: [],
        response_time_ms: Date.now() - startTime
      });
    }

    // Prepare contexts with source metadata (using merged content)
    const contextsWithMetadata = chunksArray.map((chunk, index) => ({
      content: chunk.merged_content || chunk.content,
      source_number: index + 1,
      title: chunk.title || 'Unknown',
      chunk_index: chunk.chunk_indices ? chunk.chunk_indices[0] : (chunk.chunk_index || 0),
      chunk_range: chunk.chunk_indices ? `${chunk.chunk_indices[0]}-${chunk.chunk_indices[chunk.chunk_indices.length - 1]}` : undefined
    }));

    // Step 7: Generate answer using GPT-4 with source citations and conversation context
    const finalQuestion = conversationContext ? conversationContext : question;
    const answer = await openai.generateAnswer(finalQuestion, contextsWithMetadata);

    // Step 8: Prepare sources for response
    const sources = chunksArray.map((chunk, index) => {
      const content = chunk.merged_content || chunk.content;
      return {
        source_number: index + 1,
        document_id: chunk.document_id,
        title: chunk.title || 'Unknown',
        chunk_index: chunk.chunk_indices ? chunk.chunk_indices[0] : (chunk.chunk_index || 0),
        chunk_range: chunk.chunk_indices ? `${chunk.chunk_indices[0]}-${chunk.chunk_indices[chunk.chunk_indices.length - 1]}` : undefined,
        chunk_content: content.substring(0, 300) + '...',
        context_enhanced: chunk.chunk_indices && chunk.chunk_indices.length > 1
      };
    });

    const responseTimeMs = Date.now() - startTime;

    // Step 9: Log the query with session tracking
    const queryResult = await c.env.DB.prepare(
      `INSERT INTO queries (user_id, question, answer, sources, status, response_time_ms, session_id, parent_query_id)
       VALUES (?, ?, ?, ?, 'success', ?, ?, ?)`
    ).bind(
      userId,
      question,
      answer,
      JSON.stringify(sources),
      responseTimeMs,
      currentSessionId,
      parent_query_id || null
    ).run();

    const queryId = queryResult.meta.last_row_id;

    const response: QueryResponse = {
      answer,
      sources,
      response_time_ms: responseTimeMs,
      query_id: queryId as number,
      session_id: currentSessionId
    };

    return c.json(response);
  } catch (error) {
    console.error('Query error:', error);
    
    const responseTimeMs = Date.now() - startTime;
    const userId = c.get('userId');
    const body = await c.req.json().catch(() => ({ question: '' }));

    // Determine error type and message
    let errorMessage = 'Failed to process query';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('api key') || errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
        errorMessage = 'OpenAI API 키가 유효하지 않습니다. 관리자 페이지에서 올바른 API 키를 설정해주세요.';
        errorCode = 'INVALID_API_KEY';
      } else if (errorMsg.includes('quota') || errorMsg.includes('rate limit')) {
        errorMessage = 'OpenAI API 사용 한도를 초과했습니다. OpenAI 계정에 크레딧을 충전하거나 잠시 후 다시 시도해주세요.';
        errorCode = 'QUOTA_EXCEEDED';
      } else if (errorMsg.includes('model')) {
        errorMessage = 'OpenAI 모델 접근 오류입니다. 관리자 페이지에서 사용 가능한 모델을 선택해주세요.';
        errorCode = 'MODEL_ERROR';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        errorMessage = 'OpenAI API 연결 오류입니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요.';
        errorCode = 'NETWORK_ERROR';
      } else {
        errorMessage = `처리 중 오류가 발생했습니다: ${error.message}`;
      }
    }

    // Log failed query
    try {
      await c.env.DB.prepare(
        `INSERT INTO queries (user_id, question, status, response_time_ms)
         VALUES (?, ?, 'failed', ?)`
      ).bind(userId, body.question, responseTimeMs).run();
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError);
    }

    return c.json({ 
      error: errorMessage,
      code: errorCode,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/query/history
 * Get user's query history
 */
query.get('/history', verifyAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await c.env.DB.prepare(
      `SELECT id, question, answer, sources, status, response_time_ms, created_at
       FROM queries
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset).all();

    return c.json({
      queries: result.results || [],
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching query history:', error);
    return c.json({ error: 'Failed to fetch query history' }, 500);
  }
});

/**
 * POST /api/query/feedback
 * Submit feedback for a query
 */
query.post('/feedback', verifyAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json();
    const { query_id, rating, comment } = body;

    if (!query_id || !rating) {
      return c.json({ error: 'query_id and rating are required' }, 400);
    }

    if (rating !== 1 && rating !== -1) {
      return c.json({ error: 'rating must be 1 or -1' }, 400);
    }

    // Verify query exists and belongs to user
    const queryRecord = await c.env.DB.prepare(
      'SELECT id FROM queries WHERE id = ? AND user_id = ?'
    ).bind(query_id, userId).first();

    if (!queryRecord) {
      return c.json({ error: 'Query not found' }, 404);
    }

    // Insert feedback
    await c.env.DB.prepare(
      `INSERT INTO feedback (query_id, user_id, rating, comment)
       VALUES (?, ?, ?, ?)`
    ).bind(query_id, userId, rating, comment || null).run();

    return c.json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return c.json({ error: 'Failed to submit feedback' }, 500);
  }
});

/**
 * Get total document count
 */
async function getDocumentCount(db: D1Database): Promise<number> {
  try {
    const result = await db.prepare(
      `SELECT COUNT(*) as count FROM documents WHERE status = 'indexed'`
    ).first<{ count: number }>();
    return result?.count || 0;
  } catch (error) {
    console.error('Error getting document count:', error);
    return 0;
  }
}

/**
 * Perform keyword-based search using BM25-like scoring
 */
async function performKeywordSearch(db: D1Database, question: string, limit: number): Promise<any[]> {
  try {
    // Simple keyword search using LIKE (for SQLite)
    // In production, use full-text search or Elasticsearch
    const keywords = question
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5); // Use top 5 keywords

    if (keywords.length === 0) {
      return [];
    }

    // Build LIKE query for each keyword
    const conditions = keywords.map(() => 'content LIKE ?').join(' OR ');
    const params = keywords.map(keyword => `%${keyword}%`);

    const result = await db.prepare(
      `SELECT dc.id, dc.document_id, dc.content, dc.chunk_index, d.title
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE d.status = 'indexed' AND (${conditions})
       LIMIT ?`
    ).bind(...params, limit).all();

    return result.results || [];
  } catch (error) {
    console.error('Keyword search error:', error);
    return [];
  }
}

export default query;

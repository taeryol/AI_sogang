// Q&A query routes

import { Hono } from 'hono';
import { Bindings, Variables } from '../types/bindings';
import { verifyAuth } from '../middleware/auth';
import { OpenAIService } from '../services/openai';
import { SimpleVectorDB } from '../services/vectordb';
import { DocumentProcessor } from '../services/document-processor';
import { QueryRequest, QueryResponse } from '../types/models';

const query = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Simple in-memory vector DB (same instance as documents route)
const vectorDB = new SimpleVectorDB();

/**
 * POST /api/query
 * Ask a question and get AI-generated answer
 */
query.post('/', verifyAuth, async (c) => {
  const startTime = Date.now();
  
  try {
    const userId = c.get('userId');
    const body: QueryRequest = await c.req.json();
    const { question } = body;

    if (!question || question.trim().length === 0) {
      return c.json({ error: 'Question is required' }, 400);
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

    // Step 1: Generate embedding for the question
    const questionEmbedding = await openai.generateEmbedding(question);

    // Step 2: Vector search for similar document chunks
    const vectorResults = await vectorDB.search(questionEmbedding, 5);

    // Step 3: Keyword search for additional context
    const keywordResults = await performKeywordSearch(c.env.DB, question, 5);

    // Step 4: Combine and deduplicate results
    const allChunks = new Map<number, any>();
    
    vectorResults.forEach(result => {
      if (!allChunks.has(result.metadata.chunk_id)) {
        allChunks.set(result.metadata.chunk_id, result.metadata);
      }
    });

    keywordResults.forEach(result => {
      if (!allChunks.has(result.id)) {
        allChunks.set(result.id, {
          chunk_id: result.id,
          document_id: result.document_id,
          content: result.content,
          title: 'Unknown' // We'll fetch this separately if needed
        });
      }
    });

    const contexts = Array.from(allChunks.values())
      .slice(0, 5)
      .map(chunk => chunk.content);

    if (contexts.length === 0) {
      // No relevant information found
      const noResultAnswer = '죄송합니다. 제공된 문서에서 관련 정보를 찾을 수 없습니다. 다른 키워드로 질문해 주시거나, 관련 문서를 업로드해 주세요.';
      
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

    // Step 5: Generate answer using GPT-4
    const answer = await openai.generateAnswer(question, contexts);

    // Step 6: Prepare sources
    const sources = Array.from(allChunks.values())
      .slice(0, 5)
      .map(chunk => ({
        document_id: chunk.document_id,
        title: chunk.title,
        chunk_content: chunk.content.substring(0, 200) + '...'
      }));

    const responseTimeMs = Date.now() - startTime;

    // Step 7: Log the query
    await c.env.DB.prepare(
      `INSERT INTO queries (user_id, question, answer, sources, status, response_time_ms)
       VALUES (?, ?, ?, ?, 'success', ?)`
    ).bind(
      userId,
      question,
      answer,
      JSON.stringify(sources),
      responseTimeMs
    ).run();

    const response: QueryResponse = {
      answer,
      sources,
      response_time_ms: responseTimeMs
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
      `SELECT dc.id, dc.document_id, dc.content, d.title
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

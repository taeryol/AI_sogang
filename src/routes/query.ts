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

    // Initialize OpenAI service
    const openai = new OpenAIService(c.env.OPENAI_API_KEY);

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

    // Log failed query
    await c.env.DB.prepare(
      `INSERT INTO queries (user_id, question, status, response_time_ms)
       VALUES (?, ?, 'failed', ?)`
    ).bind(userId, body.question, responseTimeMs).run();

    return c.json({ 
      error: 'Failed to process query',
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

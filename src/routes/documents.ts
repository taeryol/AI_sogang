// Document management routes

import { Hono } from 'hono';
import { Bindings, Variables } from '../types/bindings';
import { verifyAuth, requireAdmin } from '../middleware/auth';
import { DocumentProcessor } from '../services/document-processor';
import { OpenAIService } from '../services/openai';
import { PineconeVectorDB, VectorDocument } from '../services/vectordb';

const documents = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * GET /api/documents/stats
 * Get system statistics
 */
documents.get('/stats', verifyAuth, async (c) => {
  try {
    // Total documents
    const totalDocs = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM documents'
    ).first<{ count: number }>();

    // Total questions
    const totalQuestions = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM questions'
    ).first<{ count: number }>();

    // Average response time (last 100 queries)
    const avgResponseTime = await c.env.DB.prepare(
      'SELECT AVG(response_time) as avg_time FROM questions ORDER BY created_at DESC LIMIT 100'
    ).first<{ avg_time: number }>();

    return c.json({
      totalDocuments: totalDocs?.count || 0,
      totalQuestions: totalQuestions?.count || 0,
      averageResponseTime: avgResponseTime?.avg_time ? Math.round(avgResponseTime.avg_time) : 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ error: 'Failed to fetch statistics' }, 500);
  }
});

/**
 * GET /api/documents
 * List all documents
 */
documents.get('/', verifyAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const userRole = c.get('userRole');

    // Admin can see all documents, users can see only their own
    let query = 'SELECT id, title, filename, file_size, file_type, status, uploaded_by, created_at FROM documents';
    const params: any[] = [];

    if (userRole !== 'admin') {
      query += ' WHERE uploaded_by = ?';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await c.env.DB.prepare(query).bind(...params).all();

    return c.json({
      documents: result.results || []
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return c.json({ error: 'Failed to fetch documents' }, 500);
  }
});

/**
 * GET /api/documents/:id
 * Get single document details
 */
documents.get('/:id', verifyAuth, async (c) => {
  try {
    const documentId = c.req.param('id');
    const userId = c.get('userId');
    const userRole = c.get('userRole');

    const document = await c.env.DB.prepare(
      'SELECT * FROM documents WHERE id = ?'
    ).bind(documentId).first();

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Check permissions
    if (userRole !== 'admin' && document.uploaded_by !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return c.json({ document });
  } catch (error) {
    console.error('Error fetching document:', error);
    return c.json({ error: 'Failed to fetch document' }, 500);
  }
});

/**
 * POST /api/documents/upload
 * Upload new document
 */
documents.post('/upload', verifyAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const customTitle = formData.get('title') as string;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const filename = file.name;
    const fileType = DocumentProcessor.getFileType(filename);
    const fileSize = file.size;
    const title = customTitle && customTitle.trim() ? customTitle.trim() : filename;

    // Check file size (max 10MB)
    if (fileSize > 10 * 1024 * 1024) {
      return c.json({ error: 'File too large (max 10MB)' }, 400);
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    
    // Load parsing API keys from database
    const llamaParseKeyResult = await c.env.DB.prepare(
      'SELECT setting_value FROM api_settings WHERE setting_key = ?'
    ).bind('llamaparse_api_key').first<{ setting_value: string }>();
    
    const llamaParseKey = llamaParseKeyResult?.setting_value?.trim();
    
    console.log('[Documents] Parsing config:', {
      hasKey: !!llamaParseKey,
      keyLength: llamaParseKey?.length,
      keyPrefix: llamaParseKey?.substring(0, 7),
      keySuffix: llamaParseKey?.substring(llamaParseKey.length - 4),
      rawKeyFromDB: llamaParseKeyResult?.setting_value ? `[${llamaParseKeyResult.setting_value.length} chars]` : 'null',
      filename,
      fileType
    });
    
    // Check if API key is required for this file type
    const needsParsingAPI = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint'
    ].includes(fileType);

    if (needsParsingAPI && !llamaParseKey) {
      return c.json({ 
        error: '문서 파싱 API가 설정되지 않았습니다. 관리자 페이지에서 LlamaParse API 키를 설정해주세요.',
        debug: {
          dbQueryResult: !!llamaParseKeyResult,
          rawValue: llamaParseKeyResult?.setting_value ? 'exists' : 'null',
          afterTrim: llamaParseKey || 'empty'
        }
      }, 400);
    }

    const parsingConfig = {
      llamaParseKey
    };
    
    // Extract text content immediately for storage
    let fileContent = '';
    try {
      console.log('[Documents] Starting text extraction...');
      fileContent = await DocumentProcessor.extractText(arrayBuffer, fileType, filename, parsingConfig);
      console.log('[Documents] Text extraction successful, length:', fileContent.length);
    } catch (error) {
      console.error('[Documents] Error extracting text:', error);
      console.error('[Documents] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[Documents] API key info:', {
        hasKey: !!llamaParseKey,
        keyLength: llamaParseKey?.length,
        keyPrefix: llamaParseKey?.substring(0, 7),
        keySuffix: llamaParseKey?.substring(llamaParseKey?.length - 4)
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract text from file';
      return c.json({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
        debug: {
          hasApiKey: !!llamaParseKey,
          apiKeyLength: llamaParseKey?.length || 0,
          apiKeyPrefix: llamaParseKey?.substring(0, 7) || 'none',
          apiKeySuffix: llamaParseKey?.substring(llamaParseKey?.length - 4) || 'none'
        }
      }, 400);
    }

    if (!fileContent || fileContent.trim().length === 0) {
      console.error('[Documents] Empty file content after extraction');
      return c.json({ error: 'No text content found in the file' }, 400);
    }

    // Insert document record with file content stored in D1
    const result = await c.env.DB.prepare(
      `INSERT INTO documents (title, filename, file_size, file_type, file_content, uploaded_by, status)
       VALUES (?, ?, ?, ?, ?, ?, 'processing')`
    ).bind(title, filename, fileSize, fileType, fileContent, userId).run();

    const documentId = result.meta.last_row_id;

    // Process document asynchronously (chunk and generate embeddings)
    c.executionCtx.waitUntil(
      processDocument(c.env, documentId as number, fileContent, title)
    );

    return c.json({
      id: documentId,
      title,
      filename,
      status: 'processing',
      message: 'Document uploaded successfully. Processing...'
    }, 201);
  } catch (error) {
    console.error('Error uploading document:', error);
    return c.json({ 
      error: 'Failed to upload document',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PATCH /api/documents/:id
 * Update document (rename)
 */
documents.patch('/:id', verifyAuth, async (c) => {
  try {
    const documentId = parseInt(c.req.param('id'));
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    const { title } = await c.req.json();

    if (!title || !title.trim()) {
      return c.json({ error: 'Title is required' }, 400);
    }

    // Check if document exists
    const document = await c.env.DB.prepare(
      'SELECT id, uploaded_by FROM documents WHERE id = ?'
    ).bind(documentId).first<{ id: number; uploaded_by: number }>();

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Check permissions: owner or admin
    if (userRole !== 'admin' && document.uploaded_by !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Update document title
    await c.env.DB.prepare(
      'UPDATE documents SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(title.trim(), documentId).run();

    return c.json({ 
      message: 'Document renamed successfully',
      title: title.trim()
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return c.json({ error: 'Failed to update document' }, 500);
  }
});

/**
 * DELETE /api/documents/:id
 * Delete document
 */
documents.delete('/:id', verifyAuth, async (c) => {
  try {
    const documentId = parseInt(c.req.param('id'));
    const userId = c.get('userId');
    const userRole = c.get('userRole');

    // Check if document exists
    const document = await c.env.DB.prepare(
      'SELECT id, uploaded_by FROM documents WHERE id = ?'
    ).bind(documentId).first<{ id: number; uploaded_by: number }>();

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Check permissions: owner or admin
    if (userRole !== 'admin' && document.uploaded_by !== userId) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Load Pinecone configuration
    const pineconeKeyResult = await c.env.DB.prepare(
      'SELECT setting_value FROM api_settings WHERE setting_key = ?'
    ).bind('pinecone_api_key').first<{ setting_value: string }>();

    // Delete from Pinecone
    if (pineconeKeyResult?.setting_value) {
      const pinecone = new PineconeVectorDB(
        pineconeKeyResult.setting_value,
        'mindbase-vectors-5mchy92.svc.aped-4627-b74a.pinecone.io'
      );
      await pinecone.deleteByDocumentId(documentId);
    }

    // Delete document chunks from D1
    await c.env.DB.prepare(
      'DELETE FROM document_chunks WHERE document_id = ?'
    ).bind(documentId).run();

    // Delete document
    await c.env.DB.prepare(
      'DELETE FROM documents WHERE id = ?'
    ).bind(documentId).run();

    return c.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    return c.json({ error: 'Failed to delete document' }, 500);
  }
});

/**
 * Process document: chunk text and generate embeddings
 */
async function processDocument(
  env: Bindings,
  documentId: number,
  text: string,
  title: string
): Promise<void> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('No text content to process');
    }

    // Chunk text
    const chunks = DocumentProcessor.chunkText(text);

    // Load API key from database
    const apiKeyResult = await env.DB.prepare(
      'SELECT setting_value FROM api_settings WHERE setting_key = ?'
    ).bind('openai_api_key').first<{ setting_value: string }>();

    if (!apiKeyResult || !apiKeyResult.setting_value) {
      throw new Error('OpenAI API key not configured');
    }

    const apiKey = apiKeyResult.setting_value;

    // Initialize OpenAI service
    const openai = new OpenAIService(apiKey);

    // Load Pinecone config once
    const pineconeKeyResult = await env.DB.prepare(
      'SELECT setting_value FROM api_settings WHERE setting_key = ?'
    ).bind('pinecone_api_key').first<{ setting_value: string }>();

    // Process all chunks in parallel (병렬 청크 처리)
    const chunkProcessingPromises = chunks.map(async (chunk) => {
      try {
        // Generate embedding
        const embedding = await openai.generateEmbedding(chunk.content);

        // Insert chunk into DB
        const chunkResult = await env.DB.prepare(
          `INSERT INTO document_chunks (document_id, content, chunk_index, embedding_id)
           VALUES (?, ?, ?, ?)`
        ).bind(
          documentId,
          chunk.content,
          chunk.index,
          `${documentId}-${chunk.index}`
        ).run();

        const chunkId = chunkResult.meta.last_row_id as number;

        // Store in Pinecone
        const vectorDoc: VectorDocument = {
          id: `${documentId}-${chunk.index}`,
          embedding,
          metadata: {
            document_id: documentId,
            chunk_id: chunkId,
            chunk_index: chunk.index,
            content: chunk.content,
            title
          }
        };

        if (pineconeKeyResult?.setting_value) {
          const pinecone = new PineconeVectorDB(
            pineconeKeyResult.setting_value,
            'mindbase-vectors-5mchy92.svc.aped-4627-b74a.pinecone.io'
          );
          await pinecone.upsert(vectorDoc);
        }
      } catch (error) {
        console.error(`Error processing chunk ${chunk.index}:`, error);
        throw error; // Re-throw to count failures
      }
    });

    // Wait for all chunks to be processed
    const results = await Promise.allSettled(chunkProcessingPromises);
    
    // Count successes and failures
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    if (failed > 0) {
      console.warn(`Document ${documentId}: ${successful}/${chunks.length} chunks processed successfully, ${failed} failed`);
    }

    // Update document status
    await env.DB.prepare(
      `UPDATE documents SET status = 'indexed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(documentId).run();

    console.log(`Document ${documentId} processed successfully with ${chunks.length} chunks`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    
    // Update status to failed
    await env.DB.prepare(
      `UPDATE documents SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(documentId).run();
  }
}

/**
 * GET /api/documents/debug-config
 * Debug endpoint to check parsing configuration
 */
documents.get('/debug-config', verifyAuth, requireAdmin, async (c) => {
  try {
    const llamaParseKeyResult = await c.env.DB.prepare(
      'SELECT setting_value FROM api_settings WHERE setting_key = ?'
    ).bind('llamaparse_api_key').first<{ setting_value: string }>();
    
    const llamaParseKey = llamaParseKeyResult?.setting_value?.trim();
    
    return c.json({
      hasLlamaParseKey: !!llamaParseKey,
      keyLength: llamaParseKey?.length || 0,
      keyPrefix: llamaParseKey?.substring(0, 7) || 'none',
      message: llamaParseKey ? 'LlamaParse API key configured' : 'No API key found'
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

/**
 * POST /api/documents/test-parse
 * Debug endpoint to test actual file parsing with detailed error logging
 */
documents.post('/test-parse', verifyAuth, requireAdmin, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }
    
    // Load API key
    const llamaParseKeyResult = await c.env.DB.prepare(
      'SELECT setting_value FROM api_settings WHERE setting_key = ?'
    ).bind('llamaparse_api_key').first<{ setting_value: string }>();
    
    const apiKey = llamaParseKeyResult?.setting_value?.trim();
    
    if (!apiKey) {
      return c.json({ error: 'No LlamaParse API key configured' }, 400);
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const filename = file.name;
    
    console.log('[TestParse] Starting test with file:', filename, 'Size:', arrayBuffer.byteLength);
    
    // Call LlamaParse directly
    const formData2 = new FormData();
    const blob = new Blob([arrayBuffer], { type: file.type });
    formData2.append('file', blob, filename);
    
    const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      body: formData2
    });
    
    const responseStatus = uploadResponse.status;
    const responseHeaders = Object.fromEntries(uploadResponse.headers.entries());
    const responseBody = await uploadResponse.text();
    
    console.log('[TestParse] Response status:', responseStatus);
    console.log('[TestParse] Response headers:', responseHeaders);
    console.log('[TestParse] Response body:', responseBody);
    
    // Try to parse as JSON
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseBody);
    } catch {
      parsedResponse = null;
    }
    
    return c.json({
      success: uploadResponse.ok,
      status: responseStatus,
      headers: responseHeaders,
      bodyRaw: responseBody,
      bodyParsed: parsedResponse,
      message: uploadResponse.ok ? 'Upload successful' : 'Upload failed'
    });
  } catch (error) {
    console.error('[TestParse] Exception:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

export default documents;

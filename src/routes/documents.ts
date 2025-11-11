// Document management routes

import { Hono } from 'hono';
import { Bindings, Variables } from '../types/bindings';
import { verifyAuth, requireAdmin } from '../middleware/auth';
import { DocumentProcessor } from '../services/document-processor';
import { OpenAIService } from '../services/openai';
import { SimpleVectorDB, VectorDocument } from '../services/vectordb';

const documents = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Simple in-memory vector DB (replace with Pinecone in production)
const vectorDB = new SimpleVectorDB();

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
      keyPrefix: llamaParseKey?.substring(0, 4),
      filename,
      fileType
    });
    
    const parsingConfig = {
      llamaParseKey
    };
    
    // Extract text content immediately for storage
    let fileContent = '';
    try {
      fileContent = await DocumentProcessor.extractText(arrayBuffer, fileType, filename, parsingConfig);
    } catch (error) {
      console.error('[Documents] Error extracting text:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to extract text from file';
      return c.json({ error: errorMessage }, 400);
    }

    if (!fileContent || fileContent.trim().length === 0) {
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
 * DELETE /api/documents/:id
 * Delete document
 */
documents.delete('/:id', verifyAuth, requireAdmin, async (c) => {
  try {
    const documentId = parseInt(c.req.param('id'));

    // Check if document exists
    const document = await c.env.DB.prepare(
      'SELECT id FROM documents WHERE id = ?'
    ).bind(documentId).first();

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Delete from vector DB
    await vectorDB.deleteByDocumentId(documentId);

    // Delete document chunks
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

    // Generate embeddings and store chunks
    for (const chunk of chunks) {
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

        // Store in vector DB
        const vectorDoc: VectorDocument = {
          id: `${documentId}-${chunk.index}`,
          embedding,
          metadata: {
            document_id: documentId,
            chunk_id: chunkId,
            content: chunk.content,
            title
          }
        };

        await vectorDB.upsert(vectorDoc);
      } catch (error) {
        console.error(`Error processing chunk ${chunk.index}:`, error);
      }
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

export default documents;

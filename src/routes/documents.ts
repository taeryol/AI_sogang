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

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const filename = file.name;
    const fileType = DocumentProcessor.getFileType(filename);
    const fileSize = file.size;

    // Check file size (max 10MB)
    if (fileSize > 10 * 1024 * 1024) {
      return c.json({ error: 'File too large (max 10MB)' }, 400);
    }

    // Generate R2 key
    const r2Key = `documents/${userId}/${Date.now()}-${filename}`;

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.DOCUMENTS.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: fileType
      }
    });

    // Insert document record
    const result = await c.env.DB.prepare(
      `INSERT INTO documents (title, filename, file_size, file_type, r2_key, uploaded_by, status)
       VALUES (?, ?, ?, ?, ?, ?, 'processing')`
    ).bind(filename, filename, fileSize, fileType, r2Key, userId).run();

    const documentId = result.meta.last_row_id;

    // Process document asynchronously (in real app, use a queue)
    c.executionCtx.waitUntil(
      processDocument(c.env, documentId as number, arrayBuffer, fileType, filename)
    );

    return c.json({
      id: documentId,
      title: filename,
      filename,
      status: 'processing',
      message: 'Document uploaded successfully. Processing...'
    }, 201);
  } catch (error) {
    console.error('Error uploading document:', error);
    return c.json({ error: 'Failed to upload document' }, 500);
  }
});

/**
 * DELETE /api/documents/:id
 * Delete document
 */
documents.delete('/:id', verifyAuth, requireAdmin, async (c) => {
  try {
    const documentId = parseInt(c.req.param('id'));

    // Get document info
    const document = await c.env.DB.prepare(
      'SELECT r2_key FROM documents WHERE id = ?'
    ).bind(documentId).first();

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Delete from R2
    await c.env.DOCUMENTS.delete(document.r2_key as string);

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
 * Process document: extract text, chunk, generate embeddings
 */
async function processDocument(
  env: Bindings,
  documentId: number,
  fileBuffer: ArrayBuffer,
  fileType: string,
  title: string
): Promise<void> {
  try {
    // Extract text
    const text = await DocumentProcessor.extractText(fileBuffer, fileType);

    if (!text || text.trim().length === 0) {
      throw new Error('No text extracted from document');
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

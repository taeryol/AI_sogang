// Document processing service for chunking and text extraction
import { DocumentParserAPI } from './document-parser-api';

export interface DocumentChunk {
  content: string;
  index: number;
}

export interface ParsingConfig {
  llamaParseKey?: string;
}

export class DocumentProcessor {
  /**
   * Split text into chunks for embedding
   * Uses simple paragraph-based chunking with overlap
   */
  static chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    // Clean text
    const cleanedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Split by paragraphs first
    const paragraphs = cleanedText.split(/\n\n+/);
    
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      
      if (!trimmedParagraph) continue;

      // If adding this paragraph would exceed chunk size
      if (currentChunk.length + trimmedParagraph.length > chunkSize) {
        if (currentChunk) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunkIndex++
          });

          // Keep overlap from previous chunk
          const words = currentChunk.split(/\s+/);
          const overlapWords = Math.floor(overlap / 5); // Approximate word count for overlap
          currentChunk = words.slice(-overlapWords).join(' ') + '\n\n';
        }
      }

      currentChunk += trimmedParagraph + '\n\n';
    }

    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex
      });
    }

    return chunks;
  }

  /**
   * Extract text from plain text files
   */
  static async extractTextFromTXT(file: ArrayBuffer): Promise<string> {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(file);
  }

  /**
   * Simple markdown extraction
   */
  static async extractTextFromMarkdown(file: ArrayBuffer): Promise<string> {
    const decoder = new TextDecoder('utf-8');
    const markdown = decoder.decode(file);
    
    // Remove markdown syntax (simple approach)
    return markdown
      .replace(/^#{1,6}\s+/gm, '') // Headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
      .replace(/\*(.+?)\*/g, '$1') // Italic
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
      .replace(/`{1,3}[^`]+`{1,3}/g, '') // Code
      .replace(/^\s*[-*+]\s+/gm, '') // Lists
      .trim();
  }

  /**
   * Extract text from PDF/DOCX/PPTX using external parsing API
   */
  static async extractTextFromDocument(
    file: ArrayBuffer,
    filename: string,
    fileType: string,
    config: ParsingConfig
  ): Promise<string> {
    console.log('[DocumentProcessor] Calling parseDocument...', {
      filename,
      fileType,
      fileSize: file.byteLength
    });
    
    const result = await DocumentParserAPI.parseDocument(file, filename, fileType, config);
    
    console.log('[DocumentProcessor] Parse result:', {
      hasText: !!result.text,
      textLength: result.text?.length || 0,
      hasError: !!result.error,
      error: result.error
    });
    
    if (result.error) {
      console.error('[DocumentProcessor] Parse error:', result.error);
      throw new Error(`파싱 실패: ${result.error}`);
    }
    
    if (!result.text || result.text.trim().length === 0) {
      console.error('[DocumentProcessor] Empty text after parsing');
      throw new Error('문서에서 텍스트를 추출할 수 없습니다. 파일이 비어있거나 이미지만 포함되어 있을 수 있습니다.');
    }
    
    console.log('[DocumentProcessor] Successfully extracted text, length:', result.text.length);
    return result.text.trim();
  }

  /**
   * Detect file type from filename
   */
  static getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'txt':
        return 'text/plain';
      case 'md':
      case 'markdown':
        return 'text/markdown';
      case 'pdf':
        return 'application/pdf';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'doc':
        return 'application/msword';
      case 'pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'ppt':
        return 'application/vnd.ms-powerpoint';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Extract text based on file type
   */
  static async extractText(
    file: ArrayBuffer,
    fileType: string,
    filename: string,
    config?: ParsingConfig
  ): Promise<string> {
    try {
      switch (fileType) {
        case 'text/plain':
          return await this.extractTextFromTXT(file);
        
        case 'text/markdown':
          return await this.extractTextFromMarkdown(file);
        
        case 'application/pdf':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.ms-powerpoint':
          // Use external API for complex documents
          if (!config || !config.llamaParseKey) {
            throw new Error('문서 파싱 API가 설정되지 않았습니다. 관리자 페이지에서 LlamaParse API 키를 설정해주세요.');
          }
          return await this.extractTextFromDocument(file, filename, fileType, config);
        
        default:
          throw new Error(`지원되지 않는 파일 형식입니다: ${fileType}`);
      }
    } catch (error) {
      console.error('Text extraction error:', error);
      throw error;
    }
  }

  /**
   * Calculate BM25 score for keyword search
   * Simplified implementation for in-memory search
   */
  static calculateBM25(query: string, document: string, avgDocLength: number, k1: number = 1.5, b: number = 0.75): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const docTerms = document.toLowerCase().split(/\s+/);
    const docLength = docTerms.length;
    
    let score = 0;
    
    for (const term of queryTerms) {
      const termFreq = docTerms.filter(t => t === term).length;
      
      if (termFreq === 0) continue;
      
      // Simplified BM25 calculation
      const idf = Math.log((1 + termFreq) / (termFreq + 1));
      const tf = (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));
      
      score += idf * tf;
    }
    
    return score;
  }
}

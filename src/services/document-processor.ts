// Document processing service for chunking and text extraction

export interface DocumentChunk {
  content: string;
  index: number;
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
   * Extract text from PDF files
   * Note: Cloudflare Workers doesn't support Node.js libraries like pdf-parse
   * For production, integrate with external PDF parsing API
   */
  static async extractTextFromPDF(file: ArrayBuffer): Promise<string> {
    throw new Error(
      'PDF 파일은 현재 지원되지 않습니다.\n\n' +
      '📝 해결 방법:\n' +
      '1. PDF를 텍스트 파일(.txt)로 변환하여 업로드\n' +
      '2. PDF 내용을 복사하여 .txt 파일로 저장 후 업로드\n' +
      '3. 온라인 변환 도구 사용: https://pdftotext.com\n\n' +
      '💡 향후 업데이트에서 PDF 직접 지원 예정입니다.'
    );
  }

  /**
   * Extract text from DOCX files
   * Note: DOCX parsing requires external service in Cloudflare Workers
   */
  static async extractTextFromDOCX(file: ArrayBuffer): Promise<string> {
    throw new Error(
      'DOCX 파일은 현재 지원되지 않습니다.\n\n' +
      '📝 해결 방법:\n' +
      '1. Word 문서를 텍스트 파일(.txt)로 저장\n' +
      '2. 파일 → 다른 이름으로 저장 → 파일 형식: 텍스트 파일\n' +
      '3. 저장된 .txt 파일을 업로드\n\n' +
      '💡 향후 업데이트에서 DOCX 직접 지원 예정입니다.'
    );
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
      case 'doc':
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Extract text based on file type
   */
  static async extractText(file: ArrayBuffer, fileType: string): Promise<string> {
    try {
      switch (fileType) {
        case 'text/plain':
          return await this.extractTextFromTXT(file);
        
        case 'text/markdown':
          return await this.extractTextFromMarkdown(file);
        
        case 'application/pdf':
          return await this.extractTextFromPDF(file);
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractTextFromDOCX(file);
        
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
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

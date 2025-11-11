// External Document Parsing API Service
// Supports LlamaParse and PDF.co for parsing PDF, DOCX, PPTX files

export interface ParseResult {
  text: string;
  pages?: number;
  error?: string;
}

export class DocumentParserAPI {
  /**
   * Parse document using LlamaParse API
   * Free tier: 1000 pages/day
   * Supports: PDF, DOCX, PPTX, TXT, MD, HTML
   */
  static async parseWithLlamaParse(
    file: ArrayBuffer,
    filename: string,
    apiKey: string
  ): Promise<ParseResult> {
    try {
      // Step 1: Upload document
      const formData = new FormData();
      formData.append('file', new Blob([file]), filename);

      const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        throw new Error(`LlamaParse upload failed: ${error}`);
      }

      const uploadResult = await uploadResponse.json();
      const jobId = uploadResult.id;

      // Step 2: Poll for completion (max 60 seconds)
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const statusResponse = await fetch(
          `https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Accept': 'application/json'
            }
          }
        );

        if (!statusResponse.ok) {
          throw new Error('Failed to check parsing status');
        }

        const statusResult = await statusResponse.json();
        
        if (statusResult.status === 'SUCCESS') {
          return {
            text: statusResult.markdown || statusResult.text || '',
            pages: statusResult.total_pages
          };
        } else if (statusResult.status === 'ERROR') {
          throw new Error(statusResult.error || 'Parsing failed');
        }
        
        attempts++;
      }

      throw new Error('Parsing timeout (60 seconds exceeded)');
    } catch (error) {
      console.error('LlamaParse error:', error);
      return {
        text: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse PDF using PDF.co API
   * Free tier: 300 API calls/month
   */
  static async parseWithPDFco(
    file: ArrayBuffer,
    apiKey: string
  ): Promise<ParseResult> {
    try {
      // Convert to base64
      const bytes = new Uint8Array(file);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const response = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          url: `data:application/pdf;base64,${base64}`,
          inline: true
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`PDF.co API failed: ${error}`);
      }

      const result = await response.json();
      
      if (!result.body) {
        throw new Error('No text extracted from PDF');
      }

      return {
        text: result.body,
        pages: result.pageCount
      };
    } catch (error) {
      console.error('PDF.co error:', error);
      return {
        text: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Main parsing function that tries available APIs
   */
  static async parseDocument(
    file: ArrayBuffer,
    filename: string,
    fileType: string,
    config: {
      llamaParseKey?: string;
      pdfCoKey?: string;
    }
  ): Promise<ParseResult> {
    // Determine which API to use based on file type and available keys
    const isPDF = fileType === 'application/pdf';
    const isOfficeDoc = fileType.includes('openxmlformats') || fileType.includes('ms-');

    // Try LlamaParse first (supports all formats)
    if (config.llamaParseKey) {
      console.log('Attempting to parse with LlamaParse...');
      const result = await this.parseWithLlamaParse(file, filename, config.llamaParseKey);
      
      if (result.text && !result.error) {
        console.log('LlamaParse successful');
        return result;
      }
      
      console.log('LlamaParse failed:', result.error);
    }

    // Fallback to PDF.co for PDFs
    if (isPDF && config.pdfCoKey) {
      console.log('Attempting to parse with PDF.co...');
      const result = await this.parseWithPDFco(file, config.pdfCoKey);
      
      if (result.text && !result.error) {
        console.log('PDF.co successful');
        return result;
      }
      
      console.log('PDF.co failed:', result.error);
    }

    // No API available or all failed
    return {
      text: '',
      error: this.getNoAPIError(fileType, config)
    };
  }

  /**
   * Generate helpful error message when no API is configured
   */
  private static getNoAPIError(
    fileType: string,
    config: { llamaParseKey?: string; pdfCoKey?: string; }
  ): string {
    const isPDF = fileType === 'application/pdf';
    const isOffice = fileType.includes('openxmlformats') || fileType.includes('ms-');

    if (!config.llamaParseKey && !config.pdfCoKey) {
      return `문서 파싱 API가 설정되지 않았습니다.

⚙️ 관리자 설정 필요:
1. 관리자 페이지 접속
2. "API 설정" 탭
3. "문서 파싱 API" 섹션에서 API 키 입력

📝 지원되는 무료 API:
• LlamaParse (권장): PDF, DOCX, PPTX 모두 지원
• PDF.co: PDF 전용

자세한 설정 방법은 PARSING_API_SETUP.md를 참조하세요.`;
    }

    if (isOffice && !config.llamaParseKey) {
      return `DOCX/PPTX 파일 파싱을 위해서는 LlamaParse API 키가 필요합니다.

현재: PDF.co API만 설정됨 (PDF 전용)

해결 방법:
1. LlamaParse API 키 발급 (무료)
2. 관리자 페이지 > API 설정에서 추가
3. 또는 파일을 PDF로 변환 후 업로드`;
    }

    return '알 수 없는 오류가 발생했습니다.';
  }
}

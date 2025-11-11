// External Document Parsing API Service
// Supports LlamaParse for parsing PDF, DOCX, PPTX files

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
      console.log('[LlamaParse] Starting upload:', {
        filename,
        fileSize: file.byteLength,
        keyPrefix: apiKey.substring(0, 4)
      });
      
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

      console.log('[LlamaParse] Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        console.error('[LlamaParse] Upload failed:', error);
        throw new Error(`LlamaParse upload failed (${uploadResponse.status}): ${error}`);
      }

      const uploadResult = await uploadResponse.json();
      const jobId = uploadResult.id;
      console.log('[LlamaParse] Job created:', jobId);

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
          console.error('[LlamaParse] Status check failed:', statusResponse.status);
          throw new Error(`Failed to check parsing status (${statusResponse.status})`);
        }

        const statusResult = await statusResponse.json();
        console.log('[LlamaParse] Status check:', { attempt: attempts + 1, status: statusResult.status });
        
        if (statusResult.status === 'SUCCESS') {
          console.log('[LlamaParse] Parsing complete, text length:', statusResult.markdown?.length || statusResult.text?.length || 0);
          return {
            text: statusResult.markdown || statusResult.text || '',
            pages: statusResult.total_pages
          };
        } else if (statusResult.status === 'ERROR') {
          console.error('[LlamaParse] Parsing error:', statusResult.error);
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
   * Main parsing function that tries available APIs
   */
  static async parseDocument(
    file: ArrayBuffer,
    filename: string,
    fileType: string,
    config: {
      llamaParseKey?: string;
    }
  ): Promise<ParseResult> {
    // Try LlamaParse (supports all formats)
    if (config.llamaParseKey) {
      console.log('[DocumentParser] Attempting to parse with LlamaParse:', {
        filename,
        fileType,
        fileSize: file.byteLength
      });
      const result = await this.parseWithLlamaParse(file, filename, config.llamaParseKey);
      
      if (result.text && !result.error) {
        console.log('[DocumentParser] LlamaParse successful, text length:', result.text.length);
        return result;
      }
      
      console.log('[DocumentParser] LlamaParse failed:', result.error);
      // Return the error from LlamaParse instead of generic error
      return result;
    }

    // No API available
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
    config: { llamaParseKey?: string; }
  ): string {
    if (!config.llamaParseKey) {
      return `문서 파싱 API가 설정되지 않았습니다.

⚙️ 관리자 설정 필요:
1. 관리자 페이지 접속
2. "API 설정" 탭
3. "문서 파싱 API" 섹션에서 LlamaParse API 키 입력

📝 LlamaParse API:
• 무료: 1000 페이지/일
• 지원: PDF, DOCX, PPTX, HTML

자세한 설정 방법은 PARSING_API_SETUP_GUIDE.md를 참조하세요.`;
    }

    return '문서 파싱에 실패했습니다. LlamaParse API 키를 확인하거나 다시 시도해주세요.';
  }
}

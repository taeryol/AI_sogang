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
    apiKey: string,
    mimeType?: string
  ): Promise<ParseResult> {
    try {
      console.log('[LlamaParse] Starting upload:', {
        filename,
        fileSize: file.byteLength,
        mimeType,
        keyPrefix: apiKey.substring(0, 4)
      });
      
      // Step 1: Upload document
      const formData = new FormData();
      // Create blob with proper MIME type
      const blob = mimeType ? new Blob([file], { type: mimeType }) : new Blob([file]);
      formData.append('file', blob, filename);

      // Log the actual API key being used
      console.log('[LlamaParse] API key details:', {
        length: apiKey.length,
        prefix: apiKey.substring(0, 7),
        suffix: apiKey.substring(apiKey.length - 4),
        hasWhitespace: /\s/.test(apiKey),
        startsWithBearer: apiKey.startsWith('Bearer '),
        authHeader: `Bearer ${apiKey}`.substring(0, 20) + '...'
      });
      
      const uploadResponse = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      console.log('[LlamaParse] Upload response status:', uploadResponse.status);
      console.log('[LlamaParse] Upload response headers:', Object.fromEntries(uploadResponse.headers.entries()));

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[LlamaParse] Upload failed - Status:', uploadResponse.status);
        console.error('[LlamaParse] Upload failed - Response body:', errorText);
        
        // Try to parse error as JSON for better message
        try {
          const errorJson = JSON.parse(errorText);
          console.error('[LlamaParse] Upload failed - Parsed error:', errorJson);
          const errorMsg = errorJson.detail || errorJson.message || errorJson.error || errorText;
          throw new Error(`LlamaParse 업로드 실패 (${uploadResponse.status}): ${errorMsg}`);
        } catch (parseError) {
          // If not JSON, use raw text
          throw new Error(`LlamaParse 업로드 실패 (${uploadResponse.status}): ${errorText}`);
        }
      }

      const uploadResult = await uploadResponse.json();
      console.log('[LlamaParse] Upload result:', uploadResult);
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
          const statusErrorText = await statusResponse.text();
          console.error('[LlamaParse] Status check failed - Status:', statusResponse.status);
          console.error('[LlamaParse] Status check failed - Response:', statusErrorText);
          throw new Error(`파싱 상태 확인 실패 (${statusResponse.status}): ${statusErrorText}`);
        }

        const statusResult = await statusResponse.json();
        console.log('[LlamaParse] Status check:', { 
          attempt: attempts + 1, 
          status: statusResult.status,
          jobId: jobId,
          fullResult: statusResult
        });
        
        if (statusResult.status === 'SUCCESS') {
          console.log('[LlamaParse] Parsing complete!');
          console.log('[LlamaParse] Full result structure:', {
            hasMarkdown: 'markdown' in statusResult,
            hasText: 'text' in statusResult,
            markdownType: typeof statusResult.markdown,
            textType: typeof statusResult.text,
            markdownLength: statusResult.markdown?.length || 0,
            textLength: statusResult.text?.length || 0,
            allKeys: Object.keys(statusResult)
          });
          
          // Extract text from result - try multiple fields
          let extractedText = '';
          
          if (statusResult.markdown && statusResult.markdown.trim().length > 0) {
            extractedText = statusResult.markdown;
            console.log('[LlamaParse] ✅ Using markdown field, length:', extractedText.length);
          } else if (statusResult.text && statusResult.text.trim().length > 0) {
            extractedText = statusResult.text;
            console.log('[LlamaParse] ✅ Using text field, length:', extractedText.length);
          } else if (statusResult.result && typeof statusResult.result === 'string') {
            extractedText = statusResult.result;
            console.log('[LlamaParse] ✅ Using result field, length:', extractedText.length);
          } else if (statusResult.content && typeof statusResult.content === 'string') {
            extractedText = statusResult.content;
            console.log('[LlamaParse] ✅ Using content field, length:', extractedText.length);
          } else {
            console.error('[LlamaParse] ❌ No text found in any expected field!');
            console.error('[LlamaParse] Available fields:', Object.keys(statusResult));
            console.error('[LlamaParse] Markdown value:', statusResult.markdown);
            console.error('[LlamaParse] Text value:', statusResult.text);
            console.error('[LlamaParse] Full result (stringified):', JSON.stringify(statusResult, null, 2).substring(0, 1000));
          }
          
          console.log('[LlamaParse] Final extracted text length:', extractedText.length);
          console.log('[LlamaParse] Final extracted text preview:', extractedText.substring(0, 200));
          
          return {
            text: extractedText,
            pages: statusResult.total_pages,
            error: extractedText.length === 0 ? 'LlamaParse returned empty text' : undefined
          };
        } else if (statusResult.status === 'ERROR') {
          console.error('[LlamaParse] Job failed with ERROR status');
          console.error('[LlamaParse] Full error result:', statusResult);
          const errorDetail = statusResult.error || statusResult.message || statusResult.detail || 'Unknown parsing error';
          throw new Error(`LlamaParse 파싱 오류: ${errorDetail}`);
        }
        
        attempts++;
      }

      throw new Error('파싱 타임아웃 (60초 초과). 파일이 너무 크거나 복잡할 수 있습니다.');
    } catch (error) {
      console.error('[LlamaParse] Exception caught:', error);
      console.error('[LlamaParse] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[LlamaParse] Error message:', error instanceof Error ? error.message : String(error));
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        text: '',
        error: `LlamaParse API 오류: ${errorMessage}`
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
      const result = await this.parseWithLlamaParse(file, filename, config.llamaParseKey, fileType);
      
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

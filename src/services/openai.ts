// OpenAI API integration service

export class OpenAIService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate embeddings for text using OpenAI's embedding model
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Reformulate user question for better search
   */
  async reformulateQuery(question: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { 
              role: 'system', 
              content: `You are a query reformulation expert. Convert natural language questions into search-optimized queries.
Extract key concepts, entities, and intent. Return only the reformulated query in Korean.

Examples:
Input: "프로젝트 일정이 어떻게 돼?"
Output: "프로젝트 일정 마일스톤 타임라인"

Input: "우리 회사 복지 제도 알려줘"
Output: "회사 복지 제도 혜택 정책"` 
            },
            { role: 'user', content: question }
          ],
          temperature: 0.3,
          max_tokens: 100
        })
      });

      if (!response.ok) {
        console.warn('Query reformulation failed, using original');
        return question;
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error reformulating query:', error);
      return question; // Fallback to original
    }
  }

  /**
   * Generate answer using GPT-4 based on retrieved context
   */
  async generateAnswer(
    question: string, 
    contexts: Array<{ content: string; source_number: number; title: string; chunk_index: number }>
  ): Promise<string> {
    try {
      const systemPrompt = `당신은 MindBase의 AI 비서입니다. 사용자의 개인 지식 관리를 돕는 똑똑한 도우미 역할을 합니다.

**역할 및 성격:**
- 친근하고 도움이 되는 전문 비서
- 사용자의 질문 의도를 정확히 이해하고 응답
- 자연스러운 대화체로 소통

**응답 규칙:**
1. 제공된 문서 컨텍스트를 기반으로 답변
2. 컨텍스트에 있는 정보를 자연스럽게 재구성하여 설명
3. **중요**: 답변에서 정보를 인용할 때 반드시 출처를 표시하세요
   - 형식: [출처 N] 또는 문장 끝에 [출처 N]
   - 예: "프로젝트는 2024년 1분기에 시작돼요 [출처 1, 청크 3]"
4. 질문과 관련된 추가 인사이트나 연결점 제공
5. 컨텍스트가 충분하지 않으면 솔직하게 말하되, 도움이 될 만한 방향 제시
6. 답변은 간결하면서도 충분히 유용하게
7. 필요시 단계별 설명이나 불릿 포인트 사용

**응답 스타일:**
- "네, 알려드릴게요" 같은 자연스러운 시작
- "~입니다" 보다는 "~해요", "~거예요" 같은 친근한 종결어미
- 이모지 적절히 활용 (📌, 💡, ✅ 등)
- 핵심은 볼드체로 강조
- **답변 마지막에 참고 문서 목록을 추가하세요**`;

      const userPrompt = `**사용자 질문:**
${question}

**참고 문서:**
${contexts.map(ctx => `📄 [출처 ${ctx.source_number}] ${ctx.title} (청크 ${ctx.chunk_index})\n${ctx.content}`).join('\n\n---\n\n')}

위 문서들을 참고해서 사용자의 질문에 친절하고 자연스럽게 답변해주세요.
답변에서 정보를 인용할 때는 반드시 [출처 번호]를 표시해주세요.`;

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7, // 더 자연스러운 응답을 위해 증가
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error generating answer:', error);
      throw error;
    }
  }

  /**
   * Batch generate embeddings for multiple texts
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.data.map((item: any) => item.embedding);
    } catch (error) {
      console.error('Error batch generating embeddings:', error);
      throw error;
    }
  }
}

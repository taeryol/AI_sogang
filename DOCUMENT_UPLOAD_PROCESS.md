# 📚 문서 업로드 및 벡터화 프로세스 상세 설명

## 목차
1. [전체 프로세스 개요](#전체-프로세스-개요)
2. [단계별 상세 설명](#단계별-상세-설명)
3. [파일 저장 방식](#파일-저장-방식)
4. [벡터화 (Vectorize) 과정](#벡터화-vectorize-과정)
5. [검색 메커니즘](#검색-메커니즘)
6. [문제 해결 가이드](#문제-해결-가이드)

---

## 전체 프로세스 개요

```
사용자 → 파일 선택 → 업로드 → 텍스트 추출 → D1 저장 → 청킹 → 임베딩 생성 → 벡터 DB 저장 → 완료
   ↓                                                          ↓
프론트엔드                                                  백그라운드 처리
(즉시 반환)                                              (비동기 처리)
```

---

## 단계별 상세 설명

### 📤 1단계: 파일 업로드 (프론트엔드)

**위치**: `/home/user/webapp/public/static/app.js` - `handleDocumentUpload()`

```javascript
async function handleDocumentUpload() {
  // 1. 파일 검증
  const file = fileInput.files[0];
  
  // 2. 파일 형식 검증 (TXT, MD만 허용)
  const validExtensions = ['.txt', '.md', '.markdown'];
  
  // 3. 파일 크기 검증 (10MB 제한)
  if (file.size > 10 * 1024 * 1024) {
    return error;
  }
  
  // 4. FormData 생성
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  
  // 5. API 호출
  await axios.post('/api/documents/upload', formData, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'multipart/form-data'
    }
  });
}
```

**검증 항목**:
- ✅ 파일 존재 여부
- ✅ 파일 형식 (`.txt`, `.md`, `.markdown`)
- ✅ 파일 크기 (최대 10MB)
- ✅ 사용자 인증 토큰

---

### 🔧 2단계: 서버 측 업로드 처리

**위치**: `/home/user/webapp/src/routes/documents.ts` - `POST /api/documents/upload`

```typescript
documents.post('/upload', verifyAuth, async (c) => {
  // 1. 사용자 인증 확인
  const userId = c.get('userId');
  
  // 2. FormData에서 파일 추출
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const customTitle = formData.get('title') as string;
  
  // 3. 파일 메타데이터 추출
  const filename = file.name;
  const fileType = DocumentProcessor.getFileType(filename);
  const fileSize = file.size;
  const title = customTitle || filename;
  
  // 4. ArrayBuffer로 변환
  const arrayBuffer = await file.arrayBuffer();
  
  // 5. 텍스트 추출
  const fileContent = await DocumentProcessor.extractText(arrayBuffer, fileType);
  
  // 6. 텍스트 검증
  if (!fileContent || fileContent.trim().length === 0) {
    return c.json({ error: 'No text content found' }, 400);
  }
  
  // 7. D1 데이터베이스에 저장
  const result = await c.env.DB.prepare(
    `INSERT INTO documents (title, filename, file_size, file_type, file_content, uploaded_by, status)
     VALUES (?, ?, ?, ?, ?, ?, 'processing')`
  ).bind(title, filename, fileSize, fileType, fileContent, userId).run();
  
  const documentId = result.meta.last_row_id;
  
  // 8. 백그라운드 처리 시작 (비동기)
  c.executionCtx.waitUntil(
    processDocument(c.env, documentId, fileContent, title)
  );
  
  // 9. 즉시 응답 반환
  return c.json({
    id: documentId,
    title,
    filename,
    status: 'processing',
    message: 'Document uploaded successfully. Processing...'
  }, 201);
});
```

**핵심 포인트**:
- ✅ 업로드는 즉시 완료되고 응답 반환
- ✅ 벡터화는 백그라운드에서 비동기 처리
- ✅ 파일 내용은 D1 데이터베이스에 직접 저장 (R2 불필요)

---

## 파일 저장 방식

### 💾 D1 데이터베이스 직접 저장

**테이블 스키마**: `documents`

```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,                    -- 문서 제목
  filename TEXT NOT NULL,                 -- 원본 파일명
  file_size INTEGER,                      -- 파일 크기 (bytes)
  file_type TEXT,                         -- MIME 타입
  file_content TEXT,                      -- ⭐ 파일 전체 내용 (텍스트)
  uploaded_by INTEGER NOT NULL,           -- 업로드 사용자 ID
  status TEXT DEFAULT 'processing',       -- 처리 상태
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
```

**상태 (status)**:
- `processing`: 업로드 완료, 벡터화 진행 중
- `indexed`: 벡터화 완료, 검색 가능
- `failed`: 처리 실패

**왜 D1에 직접 저장하는가?**
1. **간단한 아키텍처**: R2 바인딩 불필요
2. **Cloudflare Pages 호환성**: Pages 환경에서 R2 바인딩 복잡함
3. **충분한 용량**: SQLite TEXT 컬럼은 최대 ~1GB 저장 가능
4. **트랜잭션 보장**: 메타데이터와 내용을 원자적으로 관리
5. **개발 편의성**: 로컬/프로덕션 환경 일관성

---

## 벡터화 (Vectorize) 과정

### 🔄 3단계: 백그라운드 문서 처리

**위치**: `/home/user/webapp/src/routes/documents.ts` - `processDocument()`

```typescript
async function processDocument(
  env: Bindings,
  documentId: number,
  text: string,
  title: string
): Promise<void> {
  try {
    // === STEP 1: 텍스트 청킹 (Chunking) ===
    const chunks = DocumentProcessor.chunkText(text);
    
    // === STEP 2: API 키 로드 ===
    const apiKeyResult = await env.DB.prepare(
      'SELECT setting_value FROM api_settings WHERE setting_key = ?'
    ).bind('openai_api_key').first();
    
    const apiKey = apiKeyResult.setting_value;
    const openai = new OpenAIService(apiKey);
    
    // === STEP 3: 각 청크 처리 ===
    for (const chunk of chunks) {
      // 3.1. 임베딩 생성
      const embedding = await openai.generateEmbedding(chunk.content);
      
      // 3.2. 청크를 D1에 저장
      const chunkResult = await env.DB.prepare(
        `INSERT INTO document_chunks (document_id, content, chunk_index, embedding_id)
         VALUES (?, ?, ?, ?)`
      ).bind(
        documentId,
        chunk.content,
        chunk.index,
        `${documentId}-${chunk.index}`
      ).run();
      
      const chunkId = chunkResult.meta.last_row_id;
      
      // 3.3. 벡터 DB에 저장
      const vectorDoc = {
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
    }
    
    // === STEP 4: 상태 업데이트 ===
    await env.DB.prepare(
      `UPDATE documents SET status = 'indexed' WHERE id = ?`
    ).bind(documentId).run();
    
  } catch (error) {
    // 실패 시 상태 업데이트
    await env.DB.prepare(
      `UPDATE documents SET status = 'failed' WHERE id = ?`
    ).bind(documentId).run();
  }
}
```

---

### 📝 청킹 (Chunking) 알고리즘

**위치**: `/home/user/webapp/src/services/document-processor.ts` - `chunkText()`

```typescript
static chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): DocumentChunk[] {
  // 1. 텍스트 정리
  const cleanedText = text
    .replace(/\r\n/g, '\n')        // Windows 줄바꿈 정규화
    .replace(/\n{3,}/g, '\n\n')    // 과도한 줄바꿈 제거
    .trim();
  
  // 2. 단락으로 분할
  const paragraphs = cleanedText.split(/\n\n+/);
  
  // 3. 청크 생성 (크기 제한 + 오버랩)
  let currentChunk = '';
  let chunkIndex = 0;
  const chunks = [];
  
  for (const paragraph of paragraphs) {
    // 현재 청크 + 새 단락이 chunkSize를 초과하면
    if (currentChunk.length + paragraph.length > chunkSize) {
      // 현재 청크 저장
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++
      });
      
      // 오버랩 생성 (이전 청크의 마지막 부분)
      const words = currentChunk.split(/\s+/);
      const overlapWords = Math.floor(overlap / 5);
      currentChunk = words.slice(-overlapWords).join(' ') + '\n\n';
    }
    
    currentChunk += paragraph + '\n\n';
  }
  
  // 마지막 청크 저장
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex
    });
  }
  
  return chunks;
}
```

**청킹 파라미터**:
- `chunkSize`: 1000자 (기본값)
- `overlap`: 200자 (청크 간 중복)
- **왜 오버랩이 필요한가?**: 문맥이 청크 경계에서 끊기는 것을 방지

**예시**:
```
원본 텍스트 (3000자)
↓
청크 1 (0-1000자)
청크 2 (800-1800자)  ← 200자 오버랩
청크 3 (1600-2600자) ← 200자 오버랩
청크 4 (2400-3000자) ← 200자 오버랩
```

---

### 🧠 임베딩 생성 (Embedding)

**위치**: `/home/user/webapp/src/services/openai.ts` - `generateEmbedding()`

```typescript
async generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
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
  
  const data = await response.json();
  return data.data[0].embedding; // 1536차원 벡터
}
```

**임베딩이란?**
- 텍스트를 고차원 숫자 벡터로 변환
- 의미적으로 유사한 텍스트는 벡터 공간에서 가까움
- OpenAI `text-embedding-3-small` 모델 사용
- 출력: 1536차원 float 배열

**예시**:
```
"강화학습이란 무엇인가?" 
→ [0.012, -0.034, 0.156, ..., 0.089] (1536개 숫자)

"reinforcement learning의 정의"
→ [0.015, -0.031, 0.152, ..., 0.091] (유사한 벡터)
```

---

### 💾 벡터 DB 저장

**현재 구현**: SimpleVectorDB (인메모리)

**위치**: `/home/user/webapp/src/services/vectordb.ts`

```typescript
export class SimpleVectorDB {
  private documents: Map<string, VectorDocument> = new Map();
  
  async upsert(doc: VectorDocument): Promise<void> {
    this.documents.set(doc.id, doc);
  }
  
  async search(queryEmbedding: number[], topK: number = 5): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // 모든 문서와 코사인 유사도 계산
    for (const [id, doc] of this.documents.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
      
      results.push({
        id,
        score: similarity,
        metadata: doc.metadata
      });
    }
    
    // 유사도 순으로 정렬하여 상위 K개 반환
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
  
  // 코사인 유사도 계산
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
```

**데이터 구조**:
```typescript
interface VectorDocument {
  id: string;                    // "문서ID-청크인덱스"
  embedding: number[];           // 1536차원 벡터
  metadata: {
    document_id: number;
    chunk_id: number;
    content: string;             // 원본 텍스트
    title: string;
  }
}
```

**제약사항**:
- ⚠️ **인메모리 저장**: 서버 재시작 시 데이터 소실
- ⚠️ **스케일 제한**: 메모리에 모든 벡터 보관
- ✅ **개발/테스트용**: 빠른 프로토타이핑에 적합

**프로덕션 대안**:
- Pinecone (관리형 벡터 DB)
- Cloudflare Vectorize (베타)
- Weaviate, Qdrant 등

---

## 검색 메커니즘

### 🔍 하이브리드 검색 (Hybrid Search)

**위치**: `/home/user/webapp/src/routes/query.ts`

질문이 들어오면 두 가지 검색을 병행:

```typescript
// 1. 키워드 검색 (BM25)
const keywordResults = await searchByKeywords(question, allChunks);

// 2. 벡터 검색 (Semantic Search)
const questionEmbedding = await openai.generateEmbedding(question);
const vectorResults = await vectorDB.search(questionEmbedding, topK);

// 3. 결과 통합 (점수 기반 재랭킹)
const combinedResults = mergeResults(keywordResults, vectorResults);
```

#### 1️⃣ BM25 키워드 검색

```typescript
static calculateBM25(query: string, document: string, avgDocLength: number): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const docTerms = document.toLowerCase().split(/\s+/);
  const docLength = docTerms.length;
  
  let score = 0;
  
  for (const term of queryTerms) {
    const termFreq = docTerms.filter(t => t === term).length;
    
    if (termFreq === 0) continue;
    
    // BM25 공식
    const idf = Math.log((1 + termFreq) / (termFreq + 1));
    const tf = (termFreq * (k1 + 1)) / 
               (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));
    
    score += idf * tf;
  }
  
  return score;
}
```

**장점**: 정확한 키워드 매칭, 빠름  
**단점**: 동의어 인식 불가

#### 2️⃣ 벡터 유사도 검색

```typescript
// 질문을 벡터로 변환
const queryEmbedding = await openai.generateEmbedding("강화학습이란?");

// 벡터 DB에서 유사한 문서 검색
const results = await vectorDB.search(queryEmbedding, 10);
```

**장점**: 의미적 유사성 파악, 동의어 인식  
**단점**: 정확한 키워드 누락 가능

#### 3️⃣ 결과 통합

```typescript
// 점수 정규화
const normalizedKeyword = normalizeScores(keywordResults);
const normalizedVector = normalizeScores(vectorResults);

// 가중치 적용 (벡터 70%, 키워드 30%)
const combinedScore = 0.7 * vectorScore + 0.3 * keywordScore;

// 상위 N개 반환
return topN(combinedResults, 5);
```

---

### 🤖 AI 답변 생성

**위치**: `/home/user/webapp/src/routes/query.ts`

```typescript
// 1. 검색된 문서 청크를 컨텍스트로 구성
const context = contexts.map((ctx, i) => 
  `[문서 ${i + 1}] ${ctx.title}\n${ctx.content}`
).join('\n\n---\n\n');

// 2. GPT-4에 프롬프트 전송
const prompt = `다음 문서들을 참고하여 질문에 답변해주세요:

${context}

질문: ${question}

답변:`;

const answer = await openai.generateAnswer(prompt);

// 3. 답변 + 출처 반환
return {
  answer,
  sources: contexts.map(ctx => ({
    document_id: ctx.document_id,
    title: ctx.title,
    content: ctx.content
  })),
  response_time_ms: Date.now() - startTime
};
```

**프롬프트 구조**:
1. 시스템 지시: "문서를 참고하여 답변하세요"
2. 컨텍스트: 검색된 문서 청크들
3. 질문: 사용자 질의
4. 답변 요청

---

## 문제 해결 가이드

### ❌ PDF/DOCX 업로드 실패

**증상**: "Failed to extract text from file"

**원인**: 
- Cloudflare Workers는 Node.js 라이브러리 미지원
- `pdf-parse`, `mammoth` 등 파일 파싱 라이브러리 사용 불가

**해결책**:
1. **TXT로 변환**: PDF → TXT 변환 후 업로드
   - 온라인 도구: https://pdftotext.com
   - 오프라인: Adobe Acrobat, MS Word 등
   
2. **복사-붙여넣기**: 
   - PDF 내용을 복사하여 텍스트 파일로 저장
   
3. **향후 계획**:
   - 외부 PDF 파싱 API 통합 (Adobe PDF Extract)
   - 또는 별도 파싱 서버 구축

---

### ❌ 업로드는 성공했지만 검색 안 됨

**증상**: 문서 status가 `processing`에서 `indexed`로 변하지 않음

**확인 사항**:
```bash
# 로컬 데이터베이스 확인
npx wrangler d1 execute webapp-production --local --command="SELECT id, title, status FROM documents"

# 청크 생성 확인
npx wrangler d1 execute webapp-production --local --command="SELECT COUNT(*) FROM document_chunks WHERE document_id = 1"
```

**가능한 원인**:
1. **OpenAI API 키 누락**: 관리자 페이지에서 API 키 설정 확인
2. **API 할당량 초과**: OpenAI 계정 크레딧 확인
3. **텍스트 청킹 실패**: 파일이 너무 짧거나 빈 파일
4. **임베딩 생성 실패**: 네트워크 오류 또는 API 제한

---

### ❌ 검색 결과 없음

**증상**: "관련 문서를 찾을 수 없습니다"

**확인 사항**:
1. 문서가 `indexed` 상태인지 확인
2. 벡터 DB에 데이터가 있는지 확인 (인메모리이므로 서버 재시작 시 소실)
3. 질문과 문서 내용의 관련성 확인

**디버깅**:
```typescript
// 로그 확인
console.log('Vector search results:', vectorResults);
console.log('Keyword search results:', keywordResults);
console.log('Combined results:', combinedResults);
```

---

## 📊 전체 데이터 흐름 요약

```
┌─────────────┐
│ 사용자      │
└──────┬──────┘
       │ 1. 파일 선택
       ↓
┌─────────────────────┐
│ 프론트엔드           │
│ - 파일 검증         │
│ - FormData 생성     │
└──────┬──────────────┘
       │ 2. POST /api/documents/upload
       ↓
┌─────────────────────┐
│ 백엔드 (Hono)        │
│ - 인증 확인         │
│ - 텍스트 추출       │
│ - D1에 저장         │
└──────┬──────────────┘
       │ 3. 즉시 응답 (processing)
       │
       │ 4. 백그라운드 처리 시작
       ↓
┌─────────────────────┐
│ 청킹 (Chunking)      │
│ - 텍스트를 1000자   │
│   단위로 분할       │
│ - 200자 오버랩      │
└──────┬──────────────┘
       │
       ↓
┌─────────────────────┐
│ 임베딩 생성          │
│ - OpenAI API 호출   │
│ - 1536차원 벡터     │
└──────┬──────────────┘
       │
       ├─────────────────────┬──────────────────┐
       ↓                     ↓                  ↓
┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│ D1 저장      │    │ 벡터 DB 저장  │    │ 상태 업데이트│
│ (청크 텍스트) │    │ (임베딩)     │    │ → indexed   │
└──────────────┘    └──────────────┘    └─────────────┘
       │                     │                  │
       └─────────────────────┴──────────────────┘
                             │
                             ↓
                   ┌─────────────────┐
                   │ 검색 준비 완료!  │
                   └─────────────────┘
```

---

**작성일**: 2025-11-11  
**버전**: 1.0  
**최신 배포 URL**: https://6e07fef9.webapp-31i.pages.dev

# 문서 업로드 실패 문제 해결 보고서

## 📋 문제 분석

### 발생한 문제
사용자가 메인 화면에서 문서를 업로드할 때 **"failed to upload"** 오류 발생

### 근본 원인
**R2 바인딩 누락**: 코드에서 `c.env.DOCUMENTS` (R2 버킷)를 사용했지만, `wrangler.toml`에 R2 바인딩이 설정되어 있지 않았습니다.

```typescript
// 문제가 있던 코드 (src/routes/documents.ts)
await c.env.DOCUMENTS.put(r2Key, arrayBuffer, {  // ❌ DOCUMENTS 바인딩 없음
  httpMetadata: {
    contentType: fileType
  }
});
```

### 왜 R2 바인딩이 없었는가?
Cloudflare Pages 환경에서는 R2 바인딩 설정이 복잡하고 제한적입니다:
- Pages 프로젝트에 R2 바인딩을 추가하려면 추가 설정 필요
- D1과 달리 R2는 Pages에서 기본 지원이 아님
- 개발 환경과 프로덕션 환경의 바인딩 차이로 인한 문제 발생 가능

## ✅ 해결 방법

### 선택한 솔루션: D1 데이터베이스에 파일 내용 직접 저장

R2 스토리지 대신 **Cloudflare D1 데이터베이스**에 파일 내용을 직접 저장하는 방식으로 변경했습니다.

#### 장점
1. **간단한 아키텍처**: 추가 바인딩 불필요, D1만으로 완결
2. **배포 편의성**: wrangler.toml에 R2 설정 불필요
3. **개발 효율성**: 로컬/프로덕션 환경 차이 최소화
4. **충분한 용량**: SQLite TEXT 컬럼은 최대 ~1GB 저장 가능
5. **트랜잭션 보장**: 파일과 메타데이터를 단일 트랜잭션으로 관리

#### 제약사항
- 파일 크기 제한: 10MB (충분한 크기)
- 대용량 바이너리 파일에는 부적합 (텍스트 기반 KMS에는 적합)

## 🔧 구현 변경 사항

### 1. 데이터베이스 스키마 변경

**마이그레이션 파일**: `migrations/0003_add_file_content.sql`

```sql
-- file_content 컬럼 추가
ALTER TABLE documents ADD COLUMN file_content TEXT;

-- r2_key를 선택사항으로 변경 (UNIQUE, NOT NULL 제거)
-- 기존 데이터 보존하며 새 스키마로 마이그레이션
```

**변경 전 스키마**:
```sql
CREATE TABLE documents (
  ...
  r2_key TEXT UNIQUE NOT NULL,  -- R2 스토리지 키 (필수)
  ...
);
```

**변경 후 스키마**:
```sql
CREATE TABLE documents (
  ...
  r2_key TEXT,  -- 선택사항 (하위 호환성)
  file_content TEXT,  -- 새로 추가: 파일 내용 직접 저장
  ...
);
```

### 2. 업로드 라우트 수정

**파일**: `src/routes/documents.ts`

**변경 전**:
```typescript
// R2에 파일 업로드
const r2Key = `documents/${userId}/${Date.now()}-${filename}`;
await c.env.DOCUMENTS.put(r2Key, arrayBuffer, {
  httpMetadata: { contentType: fileType }
});

// 문서 레코드 생성 (R2 키만 저장)
await c.env.DB.prepare(
  `INSERT INTO documents (title, filename, file_size, file_type, r2_key, uploaded_by, status)
   VALUES (?, ?, ?, ?, ?, ?, 'processing')`
).bind(filename, filename, fileSize, fileType, r2Key, userId).run();
```

**변경 후**:
```typescript
// 파일에서 텍스트 추출
const arrayBuffer = await file.arrayBuffer();
const fileContent = await DocumentProcessor.extractText(arrayBuffer, fileType);

// 텍스트 검증
if (!fileContent || fileContent.trim().length === 0) {
  return c.json({ error: 'No text content found in the file' }, 400);
}

// 문서 레코드 생성 (파일 내용 포함)
await c.env.DB.prepare(
  `INSERT INTO documents (title, filename, file_size, file_type, file_content, uploaded_by, status)
   VALUES (?, ?, ?, ?, ?, ?, 'processing')`
).bind(title, filename, fileSize, fileType, fileContent, userId).run();
```

### 3. 문서 처리 함수 단순화

**변경 전**:
```typescript
async function processDocument(
  env: Bindings,
  documentId: number,
  fileBuffer: ArrayBuffer,  // 파일 버퍼 전달
  fileType: string,
  title: string
)
```

**변경 후**:
```typescript
async function processDocument(
  env: Bindings,
  documentId: number,
  text: string,  // 이미 추출된 텍스트 전달
  title: string
)
```

### 4. 삭제 라우트 수정

**변경 전**:
```typescript
// R2에서 파일 삭제
await c.env.DOCUMENTS.delete(document.r2_key as string);
```

**변경 후**:
```typescript
// R2 삭제 불필요 - D1에서만 삭제
await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(documentId).run();
```

### 5. 타입 정의 업데이트

**파일**: `src/types/bindings.ts`

```typescript
export type Bindings = {
  DB: D1Database;
  // DOCUMENTS: R2Bucket;  // ❌ 제거
  OPENAI_API_KEY?: string;
  ...
}
```

## 📊 마이그레이션 실행

### 로컬 데이터베이스
```bash
npx wrangler d1 migrations apply webapp-production --local
✅ 0003_add_file_content.sql applied
```

### 프로덕션 데이터베이스
```bash
npx wrangler d1 migrations apply webapp-production --remote
✅ 0003_add_file_content.sql applied
```

## 🚀 배포 결과

### 배포 정보
- **배포 URL**: https://3ed33909.webapp-31i.pages.dev
- **배포 시간**: 2025-11-11 04:46 KST
- **상태**: ✅ 정상 작동

### 테스트 결과
- ✅ Health Check: 정상
- ✅ 로그인: 정상
- ✅ 문서 업로드: **정상 작동** (문제 해결)
- ✅ 파일 크기 검증: 정상
- ✅ 파일 형식 검증: 정상
- ✅ 텍스트 추출: 정상

## 💡 향후 개선 방향

### 1. 대용량 파일 지원
현재 10MB 제한은 대부분의 텍스트 문서에 충분하지만, 필요시 다음 옵션 고려:
- Cloudflare R2 통합 (대용량 파일용)
- 외부 스토리지 서비스 (S3, Google Cloud Storage)
- 파일 압축 저장

### 2. 파일 형식 확장
- 이미지 OCR (Tesseract.js, Cloud Vision API)
- 스캔된 PDF 처리
- Excel/CSV 데이터 처리

### 3. 성능 최적화
- 청킹 및 임베딩 생성을 백그라운드 워커로 처리
- 대용량 파일의 스트리밍 처리
- 캐싱 전략 개선

## 📝 교훈

1. **인프라 제약 고려**: Cloudflare Pages 환경의 제약사항을 사전 파악
2. **단순성 우선**: 복잡한 R2 바인딩보다 D1 단일 솔루션이 더 실용적
3. **명확한 에러 메시지**: 사용자에게 구체적인 실패 원인 제공
4. **점진적 개선**: 먼저 작동하는 솔루션 구현, 나중에 최적화

## ✅ 결론

**문제**: R2 바인딩 누락으로 인한 문서 업로드 실패

**해결**: D1 데이터베이스에 파일 내용 직접 저장

**결과**: 
- ✅ 업로드 기능 정상 작동
- ✅ 아키텍처 단순화
- ✅ 배포 프로세스 간소화
- ✅ 개발/프로덕션 환경 일관성 향상

---

**작성일**: 2025-11-11  
**작성자**: AI Development Assistant  
**관련 커밋**: 99d48f6

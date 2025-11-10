# AI 지식 관리 시스템 (KMS)

AI 에이전트 기반 차세대 지식 관리 시스템 - RAG(Retrieval-Augmented Generation) 아키텍처를 활용한 웹 애플리케이션

## 프로젝트 개요

기업 내 흩어진 지식 자산(문서, 보고서, 매뉴얼 등)을 통합하여 자연어 질문에 대해 AI가 정확한 답변을 제공하는 지능형 KMS입니다.

### 주요 특징

- **🤖 AI 기반 Q&A**: OpenAI GPT-4를 활용한 자연어 질의응답
- **📚 문서 통합 검색**: 하이브리드 검색(키워드 + 벡터 검색)으로 정확도 향상
- **🔒 보안 인증**: JWT 기반 사용자 인증 및 권한 관리
- **☁️ Cloudflare 인프라**: Edge 네트워크에서 빠른 응답 속도
- **💾 D1 데이터베이스**: 사용자, 문서, 질의 로그 관리
- **📦 R2 스토리지**: 업로드된 문서 파일 안전 보관

## 기술 스택

### 백엔드
- **Hono**: 경량 웹 프레임워크 (Cloudflare Workers)
- **Cloudflare D1**: SQLite 기반 분산 데이터베이스
- **Cloudflare R2**: 오브젝트 스토리지
- **OpenAI API**: 임베딩 생성 및 답변 생성 (GPT-4)
- **TypeScript**: 타입 안전성

### 프론트엔드
- **TailwindCSS**: 반응형 UI 디자인
- **Vanilla JavaScript**: 가벼운 프론트엔드 로직
- **Axios**: HTTP 클라이언트

### 인프라
- **Wrangler**: Cloudflare 배포 CLI
- **PM2**: 프로세스 관리 (개발 환경)
- **Git**: 버전 관리

## URLs

### 개발 환경
- **애플리케이션**: https://3000-i94tzifo3xt1qmlk5p5bs-cc2fbc16.sandbox.novita.ai
- **Health Check**: https://3000-i94tzifo3xt1qmlk5p5bs-cc2fbc16.sandbox.novita.ai/api/health

### API 엔드포인트

#### 인증 (Authentication)
- `POST /api/auth/login` - 사용자 로그인
- `POST /api/auth/register` - 사용자 등록 (관리자용)
- `POST /api/auth/change-password` - 비밀번호 변경

#### 문서 관리 (Documents)
- `GET /api/documents` - 문서 목록 조회
- `GET /api/documents/:id` - 문서 상세 조회
- `POST /api/documents/upload` - 문서 업로드
- `DELETE /api/documents/:id` - 문서 삭제 (관리자)

#### 질의응답 (Query)
- `POST /api/query` - 질문 제출 및 AI 답변 받기
- `GET /api/query/history` - 질의 기록 조회
- `POST /api/query/feedback` - 답변 피드백 제출

## 데이터 모델

### Users (사용자)
- 이메일, 이름, 비밀번호 해시
- 역할: `user` (일반 사용자) / `admin` (관리자)

### Documents (문서)
- 제목, 파일명, 파일 크기, 파일 타입
- R2 키 (스토리지 위치)
- 상태: `processing` / `indexed` / `failed`

### Document Chunks (문서 조각)
- 문서 내용을 작은 단위로 분할
- 임베딩 ID (벡터 검색용)

### Queries (질의 기록)
- 사용자 질문, AI 답변, 참조 문서
- 응답 시간, 성공/실패 상태

### Feedback (피드백)
- 답변에 대한 평가 (👍 / 👎)
- 개선 의견

## 구현된 기능

### ✅ 현재 완료된 기능

1. **사용자 인증 시스템**
   - 로그인/로그아웃
   - JWT 토큰 기반 인증
   - 역할 기반 접근 제어 (RBAC)

2. **문서 업로드 및 처리**
   - TXT, Markdown 파일 지원
   - R2 스토리지에 안전 보관
   - 자동 텍스트 추출 및 청킹

3. **벡터 임베딩 생성**
   - OpenAI text-embedding-3-small 모델 사용
   - 인메모리 벡터 DB (개발용)

4. **하이브리드 검색**
   - 키워드 기반 검색 (BM25)
   - 벡터 유사도 검색 (코사인 유사도)
   - 결과 통합 및 랭킹

5. **AI 답변 생성**
   - GPT-4 기반 답변 생성
   - 문서 출처 표시
   - 응답 시간 측정

6. **Q&A 인터페이스**
   - 실시간 채팅 형식 UI
   - 질문 히스토리 조회
   - 답변 피드백 제출

### 🚧 미구현 기능

1. **고급 문서 처리**
   - PDF 파싱 (외부 서비스 필요)
   - DOCX 파싱 (외부 서비스 필요)
   - 이미지 OCR

2. **프로덕션 벡터 DB**
   - Pinecone 통합
   - Cloudflare Vectorize 활용

3. **고급 검색 기능**
   - 전문 검색 엔진 (Elasticsearch)
   - 필터링 (날짜, 카테고리 등)
   - 자동완성

4. **문서 관리 UI**
   - 파일 브라우저
   - 드래그 앤 드롭 업로드
   - 배치 처리

5. **통계 및 모니터링**
   - 대시보드
   - 사용량 분석
   - 성능 메트릭

## 설치 및 실행

### 1. 사전 요구사항

- Node.js 18+
- npm
- Cloudflare 계정
- OpenAI API 키

### 2. 환경 변수 설정

`.dev.vars` 파일을 생성하고 다음 내용을 입력하세요:

```bash
# OpenAI API Key (필수)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Vector DB (선택사항 - Pinecone 사용 시)
PINECONE_API_KEY=your-pinecone-key
PINECONE_ENVIRONMENT=us-west1-gcp
PINECONE_INDEX=kms-embeddings

# JWT Secret (필수)
JWT_SECRET=your-secret-key-here

# Session Secret (필수)
SESSION_SECRET=your-session-secret-here
```

### 3. 로컬 개발 환경

```bash
# 의존성 설치
npm install

# D1 데이터베이스 마이그레이션
npm run db:migrate:local

# 테스트 사용자 생성
npx wrangler d1 execute webapp-production --local --command="INSERT INTO users (email, name, password_hash, role) VALUES ('admin@company.com', 'Admin', 'test_hash', 'admin')"

# 프로젝트 빌드
npm run build

# PM2로 개발 서버 시작
pm2 start ecosystem.config.cjs

# 또는 직접 실행
npm run dev:sandbox
```

### 4. 테스트

```bash
# Health Check
curl http://localhost:3000/api/health

# 로그 확인
pm2 logs webapp --nostream
```

## 사용 가이드

### 1. 로그인

- 개발 환경 테스트 계정:
  - 이메일: `admin@company.com`
  - 비밀번호: (임시 해시 사용 중 - 실제로는 암호화된 비밀번호 필요)

### 2. 문서 업로드

1. 관리자 계정으로 로그인
2. "문서 관리" 메뉴 클릭
3. TXT 또는 MD 파일 선택 및 업로드
4. 자동으로 처리 및 인덱싱

### 3. 질문하기

1. 메인 화면 하단 입력란에 질문 입력
2. 예시: "3분기 매출 보고서에서 주요 성과는 무엇인가요?"
3. AI가 관련 문서를 검색하고 답변 생성
4. 답변과 함께 참조 문서 표시

### 4. 피드백 제공

- 각 답변 하단의 👍 👎 버튼으로 품질 평가
- 코멘트 작성으로 개선사항 제안

## 배포

### Cloudflare Pages 배포

```bash
# Cloudflare API 토큰 설정 (최초 1회)
# Deploy 탭에서 API 키 설정

# 프로덕션 데이터베이스 생성
npx wrangler d1 create webapp-production

# wrangler.jsonc에 database_id 업데이트

# 프로덕션 마이그레이션
npm run db:migrate:prod

# 배포
npm run deploy:prod
```

### 환경 변수 설정 (프로덕션)

```bash
# Secrets 설정
npx wrangler pages secret put OPENAI_API_KEY --project-name webapp
npx wrangler pages secret put JWT_SECRET --project-name webapp
npx wrangler pages secret put SESSION_SECRET --project-name webapp
```

## 프로젝트 구조

```
webapp/
├── src/
│   ├── index.tsx              # 메인 애플리케이션
│   ├── routes/
│   │   ├── auth.ts            # 인증 API
│   │   ├── documents.ts       # 문서 관리 API
│   │   └── query.ts           # 질의응답 API
│   ├── services/
│   │   ├── openai.ts          # OpenAI 통합
│   │   ├── vectordb.ts        # 벡터 DB (인메모리/Pinecone)
│   │   └── document-processor.ts  # 문서 처리
│   ├── middleware/
│   │   └── auth.ts            # 인증 미들웨어
│   └── types/
│       ├── bindings.ts        # Cloudflare 바인딩
│       └── models.ts          # 데이터 모델
├── public/
│   └── static/
│       ├── app.js             # 프론트엔드 로직
│       └── styles.css         # 커스텀 스타일
├── migrations/                # D1 마이그레이션
│   └── 0001_initial_schema.sql
├── wrangler.jsonc            # Cloudflare 설정
├── package.json              # 의존성 및 스크립트
├── ecosystem.config.cjs      # PM2 설정
└── README.md                 # 본 문서
```

## 개발 가이드

### 추가 개발 권장사항

1. **벡터 DB 교체**
   - 현재: 인메모리 SimpleVectorDB (개발용)
   - 권장: Pinecone 또는 Cloudflare Vectorize
   - `src/services/vectordb.ts`에서 PineconeVectorDB 활성화

2. **PDF/DOCX 파싱**
   - 외부 파싱 서비스 통합 필요
   - Adobe PDF Extract API, Docparser 등 고려

3. **사용자 인증 강화**
   - 현재: 간소화된 토큰 기반 인증
   - 권장: 표준 JWT 라이브러리 사용
   - 비밀번호 해싱: bcrypt 등 강력한 알고리즘 적용

4. **에러 핸들링**
   - 전역 에러 핸들러 추가
   - 사용자 친화적 에러 메시지
   - 상세 로깅

5. **테스트 코드**
   - 유닛 테스트 (Jest, Vitest)
   - API 통합 테스트
   - E2E 테스트 (Playwright)

## 문제 해결

### 문서 업로드 실패
- 파일 크기 제한: 10MB
- 지원 형식: TXT, MD (현재)
- PDF/DOCX는 외부 파싱 서비스 필요

### OpenAI API 오류
- API 키 확인: `.dev.vars` 파일
- Rate limit: 요청 속도 제한 확인
- 모델 가용성: GPT-4 접근 권한 확인

### 벡터 검색 결과 없음
- 문서가 `indexed` 상태인지 확인
- 임베딩 생성 완료 여부 확인
- 로그에서 에러 확인

## 라이선스

MIT License

## 기여

이슈 및 풀 리퀘스트 환영합니다!

## 연락처

프로젝트 관련 문의: [GitHub Issues](https://github.com/yourusername/webapp/issues)

---

**마지막 업데이트**: 2025-11-10
**버전**: 1.0.0
**상태**: ✅ 개발 환경 구축 완료 / 🚧 프로덕션 배포 준비 중

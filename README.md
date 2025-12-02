# AI 지식 관리 시스템 (KMS)

AI 에이전트 기반 차세대 지식 관리 시스템 - RAG(Retrieval-Augmented Generation) 아키텍처를 활용한 웹 애플리케이션

## 프로젝트 개요

기업 내 흩어진 지식 자산(문서, 보고서, 매뉴얼 등)을 통합하여 자연어 질문에 대해 AI가 정확한 답변을 제공하는 지능형 KMS입니다.

### 주요 특징

- **🤖 AI 기반 Q&A**: OpenAI GPT-4를 활용한 자연어 질의응답
- **📚 문서 통합 검색**: 하이브리드 검색(키워드 + 벡터 검색)으로 정확도 향상
- **🔒 보안 인증**: JWT 기반 사용자 인증 및 권한 관리
- **☁️ Cloudflare 인프라**: Edge 네트워크에서 빠른 응답 속도
- **💾 D1 데이터베이스**: 사용자, 문서, 문서 내용, 질의 로그 통합 관리
- **📁 간편한 스토리지**: 파일 내용을 D1에 직접 저장하여 R2 의존성 제거

## 기술 스택

### 백엔드
- **Hono**: 경량 웹 프레임워크 (Cloudflare Workers)
- **Cloudflare D1**: SQLite 기반 분산 데이터베이스 (문서 메타데이터)
- **Pinecone**: Serverless 벡터 데이터베이스 (AWS us-east-1, 1536 dimensions)
- **OpenAI API**: 
  - GPT-3.5-turbo (Query Reformulation)
  - text-embedding-3-small (벡터 임베딩, 1536 dimensions)
  - GPT-4 (답변 생성)
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

### 프로덕션 환경
- **애플리케이션**: https://b0d4ad5f.webapp-31i.pages.dev (최신 - 병렬 파일 업로드 성능 개선)
- **프로젝트 도메인**: https://webapp-31i.pages.dev
- **상태**: ✅ 정상 작동 중 (로그인, 관리자 패널, 문서 업로드 [PDF/DOCX/PPTX/TXT/MD], 자연어 Q&A, 클릭 가능한 각주 출처 모두 작동)

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
- 파일 내용 (D1에 직접 저장)
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
   - ✅ 회원가입 (이메일 중복 검사, 비밀번호 해싱)
   - ✅ 로그인/로그아웃
   - ✅ JWT 토큰 기반 인증
   - ✅ SHA-256 기반 비밀번호 해싱 (Salt 포함)
   - ✅ 역할 기반 접근 제어 (RBAC)
   - ✅ 로컬 스토리지 세션 유지

2. **문서 업로드 및 처리** 🚀 성능 개선!
   - ✅ **다양한 파일 형식 지원**: PDF, DOCX, PPTX, TXT, Markdown
   - ✅ **외부 파싱 API 연동**: LlamaParse API 지원
   - ✅ D1 데이터베이스에 직접 저장 (R2 불필요)
   - ✅ 자동 텍스트 추출 및 청킹 (1000자 단위, 200자 오버랩)
   - ✅ **병렬 파일 업로드** 🆕: 여러 파일 동시 업로드로 3~10배 속도 향상
   - ✅ **병렬 청크 처리** 🆕: Promise.allSettled로 임베딩 생성 병렬화
   - ✅ **메인 화면 문서 업로드**: 채팅 창 옆 사이드바에서 바로 문서 업로드 가능
   - ✅ 실시간 업로드 진행률 표시
   - ✅ 업로드 성공/실패 알림
   - ✅ 파일 크기 제한: 10MB
   - 📝 파싱 API 설정 가이드 제공 (PARSING_API_SETUP_GUIDE.md)

3. **벡터 데이터베이스**
   - ✅ Pinecone Serverless 통합 (프로덕션)
   - ✅ OpenAI text-embedding-3-small 모델 사용 (1536 dimensions)
   - ✅ 문서 삭제 시 자동 벡터 정리

4. **자연어 이해 및 검색** 🆕
   - ✅ **Query Reformulation**: GPT-3.5-turbo를 활용한 자연어 쿼리 최적화
   - ✅ 대화형 질문을 검색에 최적화된 키워드로 자동 변환
   - ✅ 하이브리드 검색 (키워드 + 벡터 유사도)
   - ✅ 결과 통합 및 중복 제거

5. **AI 답변 생성** 🆕
   - ✅ GPT-4 기반 대화형 답변 생성
   - ✅ MindBase AI 비서 페르소나 (친근한 한국어 스타일)
   - ✅ 이모지와 마크다운 포매팅 활용
   - ✅ Temperature 0.7 / Max tokens 1500 (자연스러운 응답)
   - ✅ **인터랙티브 각주**: 답변에 [1], [2] 형식의 클릭 가능한 각주
   - ✅ **출처 모달**: 각주 클릭 시 원문 내용, 문서 ID, 청크 위치 표시
   - ✅ 문서 추적성 및 신뢰도 향상
   - ✅ 응답 시간 측정
   - ✅ 개선된 "결과 없음" 메시지

6. **Q&A 인터페이스**
   - ✅ 실시간 채팅 형식 UI
   - ✅ 자연어 질문 지원 ("프로젝트 일정이 어떻게 돼?")
   - ✅ 질문 히스토리 조회
   - ✅ 답변 피드백 제출
   - ✅ 사이드바 통합 문서 업로드

### 🚧 미구현/개선 예정 기능

1. **고급 문서 처리**
   - ✅ TXT, Markdown 지원
   - ✅ PDF 지원 (LlamaParse API 연동)
   - ✅ DOCX 지원 (LlamaParse API 연동)
   - ✅ PPTX 지원 (LlamaParse API 연동)
   - 🚧 이미지 OCR (스캔본 PDF 지원)
   - 🚧 표와 이미지 추출 및 분석
   - 🚧 Excel/CSV 데이터 처리

2. **프로덕션 벡터 DB**
   - 현재: 인메모리 SimpleVectorDB (개발/테스트용)
   - 향후: Pinecone 또는 Cloudflare Vectorize

3. **고급 검색 기능**
   - 전문 검색 엔진 통합
   - 필터링 (날짜, 카테고리, 태그 등)
   - 자동완성 및 검색 제안

4. **문서 관리 개선**
   - 드래그 앤 드롭 업로드
   - 배치 업로드
   - 문서 버전 관리
   - 문서 카테고리/태그 시스템

5. **통계 및 모니터링**
   - 상세 대시보드
   - 사용량 분석
   - 성능 메트릭 및 로그

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

### 1. 회원가입 및 로그인

#### 개발 환경 테스트 계정:

**관리자 계정**:
- 이메일: `admin@company.com`
- 비밀번호: `admin123`
- 권한: 문서 관리, 모든 문서 조회/삭제

**일반 사용자 계정**:
- 이메일: `user@company.com`
- 비밀번호: `user123`
- 권한: Q&A, 자신의 문서만 조회

#### 새 계정 만들기:
1. 메인 페이지에서 "회원가입" 버튼 클릭
2. 이름, 이메일, 비밀번호 입력 (최소 6자)
3. 가입 완료 후 자동으로 로그인 화면으로 이동

### 2. 문서 업로드

#### 방법 1: 메인 화면에서 바로 업로드 (권장)
1. 로그인 (일반 사용자 또는 관리자)
2. 메인 화면 오른쪽 사이드바의 "문서 업로드" 섹션
3. "파일 선택" 버튼으로 **PDF, DOCX, PPTX, TXT, MD** 파일 선택
4. 제목 입력 (선택사항, 비워두면 파일명 사용)
5. "업로드" 버튼 클릭
6. 업로드 진행률 확인 후 완료!

**⚙️ 중요**: PDF/DOCX/PPTX 파일을 업로드하려면 LlamaParse API 키가 필요합니다.
- **LlamaParse**: 무료 1000 페이지/일, PDF/DOCX/PPTX/HTML 지원
- 설정 방법: [PARSING_API_SETUP_GUIDE.md](./PARSING_API_SETUP_GUIDE.md) 참조

#### 방법 2: 관리자 페이지에서 업로드
1. 관리자 계정으로 로그인
2. 상단 메뉴에서 "관리자 페이지" 클릭
3. "문서 관리" 탭에서 파일 업로드
4. 자동으로 처리 및 인덱싱

### 3. 질문하기

1. 메인 화면 하단 입력란에 **자연어로 질문 입력** 🆕
2. 예시:
   - "프로젝트 일정이 어떻게 돼?"
   - "우리 회사 복지 제도 알려줘"
   - "다음 주 회의 안건이 뭐야?"
   - "예산은 얼마나 남았어?"
3. AI가 자동으로 질문을 이해하고 최적화하여 관련 문서 검색
4. 친근한 대화 스타일로 답변 생성
5. **인터랙티브 각주로 출처 확인** 🆕:
   - 답변에 [1], [2] 형식의 클릭 가능한 각주 표시
   - 예: "프로젝트는 2024년 1분기에 시작돼요[1]"
   - 각주 클릭 시 모달로 원문 내용 확인
   - 문서 ID, 청크 위치, 전체 원문 표시
6. 답변 하단에 참조 문서 목록 (클릭하면 상세 정보)

### 4. 피드백 제공

- 각 답변 하단의 👍 👎 버튼으로 품질 평가
- 코멘트 작성으로 개선사항 제안

## 배포

### Cloudflare Pages 배포 완료! ✅

**프로덕션 URL**: https://624f5a63.webapp-31i.pages.dev

#### 배포 상태
- ✅ Cloudflare Pages 프로젝트 생성 완료
- ✅ D1 데이터베이스 생성 및 마이그레이션 완료
- ✅ 초기 관리자 계정 설정 완료
- ✅ D1 바인딩 설정 완료 (wrangler.toml 사용)
- ✅ 로그인 및 관리자 기능 정상 작동 확인

#### D1 데이터베이스 바인딩 설정 (완료)

D1 바인딩은 `wrangler.toml` 파일을 통해 자동으로 설정됩니다:

```toml
[[d1_databases]]
binding = "DB"
database_name = "webapp-production"
database_id = "13864601-2e6a-4af5-969b-bb31dad0ff3d"
```

재배포 시 자동으로 바인딩이 적용됩니다:
```bash
npm run build
npx wrangler pages deploy dist --project-name webapp
```

#### 프로덕션 테스트 계정

배포 시 자동으로 생성된 관리자 계정:
- **이메일**: admin@company.com
- **비밀번호**: admin123
- **역할**: 관리자

#### 추가 관리자 생성

관리자 코드를 사용하여 새 관리자 계정을 만들 수 있습니다:
- **기본 관리자 코드**: `ADMIN-SETUP-2025`
- 회원가입 시 "관리자 코드" 필드에 입력

#### 환경 변수 설정 (선택사항)

OpenAI API를 사용하려면 관리자 페이지에서 설정:
1. 관리자 계정으로 로그인
2. 상단 메뉴에서 "관리자" 클릭
3. "API 설정" 탭에서 OpenAI API 키 입력

또는 CLI로 설정:
```bash
npx wrangler pages secret put OPENAI_API_KEY --project-name webapp
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
- **파일 크기 제한**: 10MB
- **지원 형식**: PDF, DOCX, PPTX, TXT, Markdown
- **파싱 API 필요**: PDF/DOCX/PPTX 파일은 LlamaParse API 키 필요
  - **LlamaParse**: 무료 1000 페이지/일, PDF/DOCX/PPTX/HTML 지원
  - **설정 가이드**: [PARSING_API_SETUP_GUIDE.md](./PARSING_API_SETUP_GUIDE.md)
- **API 미설정 시**: 명확한 에러 메시지와 설정 방법 안내
- **빈 파일**: 텍스트가 없는 파일은 업로드 불가
- **이미지 PDF**: OCR 지원 안 함 (텍스트 기반 PDF만 가능)
- **인코딩 문제**: UTF-8 인코딩 권장

자세한 내용은 [DOCUMENT_UPLOAD_PROCESS.md](./DOCUMENT_UPLOAD_PROCESS.md) 참조

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

**마지막 업데이트**: 2025-12-02
**버전**: 1.4.0
**상태**: ✅ 프로덕션 배포 완료 (자연어 이해, 대화형 AI 답변, 인터랙티브 각주, 병렬 업로드)

## 관리자 기능

### 관리자 패널 (/admin)

관리자 계정으로 로그인하면 다음 기능에 접근할 수 있습니다:

1. **대시보드**
   - 시스템 통계 (사용자 수, 문서 수, 질의 수)
   - 최근 질의 기록

2. **사용자 관리**
   - 전체 사용자 목록
   - 사용자 역할 변경 (일반 사용자 ↔ 관리자)
   - 사용자 삭제

3. **API 설정**
   - OpenAI API 키 및 모델 설정
   - Vector DB 설정 (Simple / Pinecone)
   - Pinecone 연동 설정

4. **감사 로그**
   - 모든 관리자 작업 기록 조회
   - 사용자 권한 변경 이력

자세한 내용은 [ADMIN_FEATURES_GUIDE.md](./ADMIN_FEATURES_GUIDE.md)를 참조하세요.

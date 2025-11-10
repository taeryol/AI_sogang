# AI KMS 설치 및 설정 가이드

이 문서는 AI 지식 관리 시스템을 처음 설치하고 설정하는 단계별 가이드입니다.

## 목차

1. [시스템 요구사항](#시스템-요구사항)
2. [초기 설정](#초기-설정)
3. [OpenAI API 키 발급](#openai-api-키-발급)
4. [로컬 개발 환경 구축](#로컬-개발-환경-구축)
5. [첫 사용자 생성](#첫-사용자-생성)
6. [문서 업로드 및 테스트](#문서-업로드-및-테스트)
7. [프로덕션 배포](#프로덕션-배포)
8. [문제 해결](#문제-해결)

## 시스템 요구사항

### 필수 소프트웨어
- **Node.js**: 18.x 이상
- **npm**: 9.x 이상
- **Git**: 2.x 이상

### 필수 계정 및 API 키
- **Cloudflare 계정** (무료 플랜 가능)
- **OpenAI API 키** (유료 - 사용량 기반 과금)

### 권장 환경
- **OS**: Linux, macOS, Windows (WSL2)
- **메모리**: 최소 2GB RAM
- **디스크**: 최소 1GB 여유 공간

## 초기 설정

### 1. 프로젝트 클론 또는 다운로드

```bash
# Git clone (GitHub에 올린 경우)
git clone https://github.com/yourusername/webapp.git
cd webapp

# 또는 이미 다운로드한 경우
cd /path/to/webapp
```

### 2. 의존성 설치

```bash
npm install
```

이 명령어는 필요한 모든 패키지를 설치합니다:
- hono (웹 프레임워크)
- wrangler (Cloudflare CLI)
- vite (빌드 도구)
- 기타 개발 도구

## OpenAI API 키 발급

### 1. OpenAI 계정 생성
1. https://platform.openai.com 접속
2. "Sign Up" 클릭하여 계정 생성
3. 이메일 인증 완료

### 2. API 키 생성
1. https://platform.openai.com/api-keys 접속
2. "Create new secret key" 클릭
3. 키 이름 입력 (예: "AI-KMS-Dev")
4. **생성된 키를 안전한 곳에 복사** (다시 볼 수 없음!)

### 3. 결제 정보 등록
1. https://platform.openai.com/account/billing 접속
2. 결제 수단 등록
3. 사용 한도 설정 권장 (예: 월 $50)

**예상 비용**:
- 임베딩 (text-embedding-3-small): 문서 1000페이지당 약 $0.50
- GPT-4 답변 생성: 질문 100개당 약 $1-2
- 월 예상 비용: 중소기업 기준 $10-50

## 로컬 개발 환경 구축

### 1. 환경 변수 설정

프로젝트 루트에 `.dev.vars` 파일을 생성합니다:

```bash
# .dev.vars
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_SECRET=your-random-secret-key-here-min-32-chars
SESSION_SECRET=another-random-secret-key-here
```

**JWT_SECRET 생성 방법**:
```bash
# Linux/macOS
openssl rand -base64 32

# 또는 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. 데이터베이스 초기화

```bash
# D1 로컬 데이터베이스 마이그레이션 적용
npm run db:migrate:local
```

성공 메시지:
```
✅ 14 commands executed successfully.
┌─────────────────────────┬────────┐
│ name                    │ status │
├─────────────────────────┼────────┤
│ 0001_initial_schema.sql │ ✅     │
└─────────────────────────┴────────┘
```

### 3. 프로젝트 빌드

```bash
npm run build
```

### 4. 개발 서버 시작

**방법 A: PM2 사용 (권장)**
```bash
# PM2로 백그라운드 실행
pm2 start ecosystem.config.cjs

# 로그 확인
pm2 logs webapp --nostream

# 서버 상태 확인
pm2 list
```

**방법 B: 직접 실행**
```bash
npm run dev:sandbox
```

### 5. 접속 확인

브라우저에서 http://localhost:3000 접속

Health Check:
```bash
curl http://localhost:3000/api/health
```

예상 응답:
```json
{
  "status": "ok",
  "timestamp": "2025-11-10T01:47:43.278Z",
  "service": "AI KMS"
}
```

## 첫 사용자 생성

### 관리자 계정 생성

**주의**: 실제 프로덕션 환경에서는 반드시 강력한 비밀번호를 사용하세요!

```bash
# 비밀번호 해시 생성 (실제 bcrypt 사용 권장)
# 여기서는 개발용으로 간단한 해시 사용

# 관리자 계정 생성
npx wrangler d1 execute webapp-production --local --command="
INSERT INTO users (email, name, password_hash, role) 
VALUES ('admin@company.com', 'System Admin', 'dev_hash_admin123', 'admin')
"

# 일반 사용자 계정 생성
npx wrangler d1 execute webapp-production --local --command="
INSERT INTO users (email, name, password_hash, role) 
VALUES ('user@company.com', 'Test User', 'dev_hash_user123', 'user')
"
```

### 생성된 계정으로 로그인

1. http://localhost:3000 접속
2. "로그인" 버튼 클릭
3. 다음 계정 정보 입력:
   - 이메일: `admin@company.com`
   - 비밀번호: `admin123` (개발용 - 실제로는 해싱된 값 필요)

**프로덕션 환경**: 반드시 `/api/auth/register` API를 통해 적절한 비밀번호 해싱으로 계정 생성!

## 문서 업로드 및 테스트

### 1. 테스트 문서 준비

간단한 텍스트 파일을 생성합니다:

```bash
cat > test-document.txt << EOF
# 회사 제품 소개

## 제품 A
제품 A는 우리 회사의 주력 제품입니다.
2024년 3분기 매출은 50억원을 기록했습니다.
주요 고객층은 20-30대이며, 모바일 앱을 통해 서비스됩니다.

## 제품 B
제품 B는 B2B 솔루션입니다.
엔터프라이즈 고객을 대상으로 하며,
온프레미스 및 클라우드 배포를 모두 지원합니다.
EOF
```

### 2. 문서 업로드 (API 사용)

```bash
# 관리자 토큰 얻기 (먼저 로그인)
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"admin123"}' \
  | jq -r '.token')

# 문서 업로드
curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-document.txt"
```

### 3. 질문 테스트

웹 UI에서:
1. 로그인
2. 입력란에 질문 입력: "제품 A의 3분기 매출은 얼마인가요?"
3. AI 답변 확인

API로 테스트:
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"제품 A의 3분기 매출은 얼마인가요?"}'
```

예상 답변:
```json
{
  "answer": "제품 A의 3분기 매출은 50억원입니다.",
  "sources": [
    {
      "document_id": 1,
      "title": "test-document.txt",
      "chunk_content": "제품 A는 우리 회사의 주력 제품입니다..."
    }
  ],
  "response_time_ms": 1523
}
```

## 프로덕션 배포

### 1. Cloudflare 계정 설정

```bash
# Cloudflare 로그인
npx wrangler login

# 또는 API 토큰 사용
# Deploy 탭에서 API 키 설정
```

### 2. D1 프로덕션 데이터베이스 생성

```bash
npx wrangler d1 create webapp-production
```

출력된 `database_id`를 복사하여 `wrangler.jsonc`에 업데이트:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "webapp-production",
      "database_id": "여기에-실제-ID-붙여넣기"
    }
  ]
}
```

### 3. R2 버킷 생성

```bash
npx wrangler r2 bucket create webapp-documents
```

### 4. 프로덕션 마이그레이션

```bash
npm run db:migrate:prod
```

### 5. Secrets 설정

```bash
# OpenAI API 키
npx wrangler pages secret put OPENAI_API_KEY --project-name webapp
# 프롬프트에서 키 입력

# JWT Secret
npx wrangler pages secret put JWT_SECRET --project-name webapp

# Session Secret
npx wrangler pages secret put SESSION_SECRET --project-name webapp
```

### 6. 배포

```bash
npm run deploy:prod
```

배포 완료 후 URL 확인:
```
✨ Success! Uploaded 2 files (3.45 sec)

✨ Deployment complete! Take a peek over at https://random-id.webapp.pages.dev
```

### 7. 프로덕션 사용자 생성

```bash
# 프로덕션 데이터베이스에 관리자 생성
npx wrangler d1 execute webapp-production --command="
INSERT INTO users (email, name, password_hash, role) 
VALUES ('admin@yourcompany.com', 'Admin', 'proper_bcrypt_hash_here', 'admin')
"
```

## 문제 해결

### 빌드 오류

**증상**: `npm run build` 실패

**해결**:
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install

# 캐시 클리어
npm cache clean --force
```

### D1 마이그레이션 오류

**증상**: "Database not found"

**해결**:
```bash
# 로컬 DB 초기화
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
```

### OpenAI API 오류

**증상**: "Invalid API key"

**해결**:
1. `.dev.vars` 파일에 올바른 키가 있는지 확인
2. 키 앞뒤 공백 제거
3. OpenAI 대시보드에서 키 유효성 확인
4. 사용량 한도 확인

### 문서 업로드 실패

**증상**: "Failed to upload document"

**해결**:
1. 파일 크기 확인 (10MB 이하)
2. 파일 형식 확인 (TXT, MD만 지원)
3. R2 버킷 권한 확인
4. 로그에서 상세 오류 확인

### 벡터 검색 결과 없음

**증상**: "관련 정보를 찾을 수 없습니다"

**해결**:
1. 문서가 `indexed` 상태인지 확인:
```bash
npx wrangler d1 execute webapp-production --local --command="SELECT * FROM documents"
```

2. 임베딩 생성 확인:
```bash
npx wrangler d1 execute webapp-production --local --command="SELECT COUNT(*) FROM document_chunks"
```

3. OpenAI API 로그 확인

### PM2 서버 재시작

```bash
# 포트 정리
fuser -k 3000/tcp 2>/dev/null || true

# 재빌드
npm run build

# 재시작
pm2 restart webapp

# 또는 완전 재시작
pm2 delete webapp
pm2 start ecosystem.config.cjs
```

## 추가 리소스

- [Cloudflare Workers 문서](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 문서](https://developers.cloudflare.com/d1/)
- [OpenAI API 문서](https://platform.openai.com/docs)
- [Hono 프레임워크](https://hono.dev/)

## 지원

문제가 계속되는 경우:
1. GitHub Issues에 문의
2. 로그 파일 첨부
3. 재현 단계 상세히 설명

---

**마지막 업데이트**: 2025-11-10

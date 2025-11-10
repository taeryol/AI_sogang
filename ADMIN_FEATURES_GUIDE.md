# 관리자 기능 가이드

## 개요

AI KMS에 관리자 전용 기능이 추가되었습니다. 이제 관리자는 별도의 관리자 페이지에서 시스템 전반을 관리할 수 있습니다.

## 🔑 주요 기능

### 1. 관리자 등록 시스템
- **관리자 코드**: 특별한 초대 코드로 관리자 권한 획득
- **코드 생성**: 기존 관리자가 새로운 관리자 초대 코드 생성
- **일회용 코드**: 각 코드는 한 번만 사용 가능

### 2. 사용자 관리 (Access Management)
- 전체 사용자 목록 조회
- 사용자 역할 변경 (user ↔ admin)
- 사용자 계정 삭제
- 감사 로그 기록

### 3. API 설정
- **OpenAI API**: API 키 설정
- **Vector DB**: Simple/Pinecone 선택 및 설정
- 암호화된 저장

### 4. 대시보드
- 시스템 통계 (사용자, 문서, 질의 수)
- 평균 응답 시간
- 최근 질의 로그

### 5. 감사 로그
- 모든 관리 작업 기록
- 누가, 언제, 무엇을 했는지 추적

---

## 📝 사용 방법

### 1️⃣ 첫 관리자 등록

#### 기본 관리자 코드
시스템에 기본으로 제공되는 관리자 코드:
```
ADMIN-SETUP-2025
```

#### 관리자로 회원가입
1. 메인 페이지 접속
2. "회원가입" 버튼 클릭
3. 정보 입력:
   - 이름: 원하는 이름
   - 이메일: 이메일 주소
   - 비밀번호: 최소 6자
   - 비밀번호 확인
   - **관리자 코드**: `ADMIN-SETUP-2025` 입력 ⭐
4. "가입하기" 클릭
5. 자동으로 관리자 권한으로 등록됨

#### 테스트 예시
```bash
POST /api/auth/register
{
  "email": "newadmin@company.com",
  "password": "admin456",
  "name": "New Admin",
  "adminCode": "ADMIN-SETUP-2025"
}

응답:
{
  "message": "User created successfully",
  "user": {
    "id": 5,
    "email": "newadmin@company.com",
    "name": "New Admin",
    "role": "admin"  ⬅️ 관리자 권한!
  }
}
```

---

### 2️⃣ 관리자 페이지 접속

#### 접속 방법
1. 관리자 계정으로 로그인
2. 상단 네비게이션에서 **"관리자 페이지"** 클릭
3. 또는 직접 URL 접속: `/admin`

#### URL
- **로컬**: http://localhost:3000/admin
- **샌드박스**: https://3000-i94tzifo3xt1qmlk5p5bs-cc2fbc16.sandbox.novita.ai/admin

#### 권한 확인
- 관리자만 접근 가능
- 일반 사용자는 메인 페이지로 리다이렉트됨

---

### 3️⃣ 대시보드 사용

#### 표시 정보
- **총 사용자**: 등록된 전체 사용자 수
- **총 문서**: 업로드된 문서 수
- **총 질의**: 처리된 질문 수
- **평균 응답시간**: AI 답변 생성 평균 시간

#### 최근 질의
- 사용자별 최근 질문 10개
- 상태, 응답시간, 시간 표시

---

### 4️⃣ 사용자 관리

#### 사용자 목록 조회
- 모든 사용자 정보 표시
- ID, 이름, 이메일, 역할, 가입일

#### 역할 변경
1. 변경할 사용자의 **<i class="fas fa-user-tag"></i>** 아이콘 클릭
2. 확인 메시지에서 "확인"
3. user ↔ admin 전환

#### 사용자 삭제
1. 삭제할 사용자의 **<i class="fas fa-trash"></i>** 아이콘 클릭
2. 확인 메시지에서 "확인"
3. 영구 삭제 (복구 불가)

#### 제한사항
- 본인 계정은 수정/삭제 불가
- 최소 1명의 관리자 필요

#### 관리자 초대 코드 생성
1. "관리자 코드 생성" 버튼 클릭
2. 새로운 코드 생성 (예: `ADMIN-A1B2C3D4`)
3. 코드가 클립보드에 자동 복사됨
4. 초대할 사람에게 코드 전달

---

### 5️⃣ API 설정

#### OpenAI API 키 설정

**필수**: AI 답변 생성에 필요

1. **API 키 발급**:
   - https://platform.openai.com/api-keys 접속
   - "Create new secret key" 클릭
   - 키 복사 (예: `sk-proj-...`)

2. **시스템에 설정**:
   - 관리자 페이지 → API 설정 탭
   - OpenAI API Key 입력
   - "저장" 버튼 클릭

3. **확인**:
   ```bash
   # 환경변수로 설정된 경우 자동 사용
   # 또는 데이터베이스에서 읽어서 사용
   ```

#### Vector DB 설정

**선택 1: Simple (기본)**
- 인메모리 벡터 DB
- 개발 및 테스트용
- 추가 설정 불필요

**선택 2: Pinecone (프로덕션)**
1. **Pinecone 계정 생성**:
   - https://www.pinecone.io/ 접속
   - 무료 계정 생성

2. **API 키 및 환경 설정**:
   - API Key 발급
   - Environment 확인 (예: `us-west1-gcp`)
   - Index 생성 (예: `kms-embeddings`)

3. **시스템에 설정**:
   - DB 유형: Pinecone 선택
   - Pinecone API Key 입력
   - Environment 입력
   - Index Name 입력
   - "저장" 버튼 클릭

---

### 6️⃣ 감사 로그

#### 로그 내용
- 사용자 역할 변경
- 사용자 삭제
- API 설정 변경
- 기타 관리 작업

#### 조회 정보
- 작업 시간
- 대상 사용자
- 작업 유형
- 상세 내용
- 수행자

---

## 🔒 보안 기능

### 관리자 코드
- 랜덤 생성 (UUID 기반)
- 일회용 (한 번 사용 후 비활성화)
- 데이터베이스에 사용 이력 저장

### API 키 저장
- 암호화 플래그 설정
- UI에서는 마스킹 표시 (`********`)
- 실제 값은 서버에서만 접근 가능

### 접근 제어
- 관리자만 관리자 페이지 접근
- JWT 토큰 검증
- 역할 기반 권한 확인

### 감사 로그
- 모든 중요 작업 기록
- 추적 가능성 확보
- 규정 준수 지원

---

## 📊 API 엔드포인트

### 사용자 관리

```
GET /api/admin/users
- 모든 사용자 조회
- 권한: admin

PUT /api/admin/users/:id/role
- 사용자 역할 변경
- Body: { role: "admin" | "user" }
- 권한: admin

DELETE /api/admin/users/:id
- 사용자 삭제
- 권한: admin
```

### API 설정

```
GET /api/admin/settings
- 모든 API 설정 조회
- 권한: admin

PUT /api/admin/settings/:key
- API 설정 업데이트
- Body: { value: "..." }
- 권한: admin
```

### 통계 및 로그

```
GET /api/admin/stats
- 시스템 통계 조회
- 권한: admin

GET /api/admin/audit-log
- 감사 로그 조회
- Query: ?limit=50
- 권한: admin
```

### 관리자 코드

```
POST /api/admin/verify-code
- 관리자 코드 검증
- Body: { code: "ADMIN-..." }
- 권한: public

POST /api/admin/generate-code
- 새 관리자 코드 생성
- 권한: admin
```

---

## 🧪 테스트 시나리오

### 시나리오 1: 첫 관리자 등록
```bash
# 1. 관리자로 회원가입
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "admin123",
    "name": "Test Admin",
    "adminCode": "ADMIN-SETUP-2025"
  }'

# 2. 로그인
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "admin123"
  }'

# 3. 토큰 저장 및 관리자 페이지 접속
# Bearer 토큰으로 API 호출
```

### 시나리오 2: 사용자 관리
```bash
# 1. 사용자 목록 조회
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/admin/users

# 2. 역할 변경
curl -X PUT http://localhost:3000/api/admin/users/3/role \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'

# 3. 사용자 삭제
curl -X DELETE http://localhost:3000/api/admin/users/4 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 시나리오 3: API 설정
```bash
# OpenAI API 키 설정
curl -X PUT http://localhost:3000/api/admin/settings/openai_api_key \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "sk-proj-YOUR_KEY_HERE"}'

# Vector DB 설정
curl -X PUT http://localhost:3000/api/admin/settings/vector_db_type \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value": "pinecone"}'
```

---

## 🎯 현재 사용 가능한 관리자 계정

### 1. 기존 관리자
- **이메일**: admin@company.com
- **비밀번호**: admin123
- **권한**: admin

### 2. 새로 생성한 관리자
- **이메일**: newadmin@company.com
- **비밀번호**: admin456
- **권한**: admin
- **등록 방법**: ADMIN-SETUP-2025 코드 사용

---

## 💡 주요 개선사항

### ✅ 구현 완료
1. ✅ 관리자 등록 코드 시스템
2. ✅ 전체 관리자 페이지 UI
3. ✅ 사용자 관리 (CRUD)
4. ✅ API 설정 관리
5. ✅ 대시보드 통계
6. ✅ 감사 로그
7. ✅ 역할 기반 접근 제어

### 🔄 향후 개선사항
1. 2단계 인증 (2FA)
2. 비밀번호 정책 강화
3. 세션 타임아웃
4. IP 기반 접근 제어
5. 로그 내보내기 (CSV, JSON)
6. 실시간 알림

---

## 📞 문의 및 지원

관리자 기능 관련 문의사항이 있으시면:
- GitHub Issues에 등록
- 관리자 페이지 내 피드백 기능 사용 (향후 추가 예정)

---

**업데이트**: 2025-11-10
**버전**: 2.0.0
**상태**: ✅ 모든 핵심 기능 구현 완료

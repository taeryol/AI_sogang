# 📄 문서 파싱 API 설정 가이드

PDF, DOCX, PPTX 파일을 업로드하고 처리하려면 외부 파싱 API 키가 필요합니다.

## 🎯 지원하는 파싱 API

### 1. LlamaParse (권장 ⭐)

**장점:**
- ✅ **다양한 형식 지원**: PDF, DOCX, PPTX, HTML, MD
- ✅ **높은 정확도**: AI 기반 파싱
- ✅ **넉넉한 무료 티어**: 1000 페이지/일
- ✅ **빠른 처리 속도**: 평균 2-5초
- ✅ **한글 지원**: 완벽한 한글 인식

**제한사항:**
- 무료 플랜: 1000 페이지/일
- 유료 플랜: $39/월 (10,000 페이지/일)

---

### 2. PDF.co (백업용)

**장점:**
- ✅ **PDF 전용**: 안정적인 PDF 파싱
- ✅ **무료 티어**: 300 호출/월
- ✅ **빠른 응답**: 즉시 처리

**제한사항:**
- ❌ PDF만 지원 (DOCX, PPTX 미지원)
- 무료 플랜: 300 호출/월
- 유료 플랜: $9.99/월 (6,000 호출)

---

## 📝 API 키 발급 방법

### LlamaParse API 키 발급 (5분 소요)

#### 1단계: LlamaIndex 계정 생성

1. **LlamaIndex Cloud 접속**
   ```
   https://cloud.llamaindex.ai
   ```

2. **Sign Up 클릭**
   - Google, GitHub 계정으로 간편 가입 가능
   - 또는 이메일로 신규 가입

#### 2단계: API 키 생성

1. **대시보드 접속 후 "API Keys" 메뉴 클릭**

2. **"Create API Key" 버튼 클릭**

3. **API 키 이름 입력**
   ```
   예: webapp-kms-parsing
   ```

4. **API 키 복사**
   ```
   llx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   ⚠️ **중요**: API 키는 한 번만 표시됩니다. 반드시 안전한 곳에 저장하세요!

#### 3단계: 무료 플랜 확인

- **기본**: 1000 페이지/일 무료
- **Usage** 탭에서 사용량 확인 가능
- 초과 시 자동으로 다음 날 리셋

---

### PDF.co API 키 발급 (3분 소요)

#### 1단계: PDF.co 계정 생성

1. **PDF.co 접속**
   ```
   https://pdf.co
   ```

2. **"Sign Up Free" 클릭**
   - 이메일 주소 입력
   - 비밀번호 설정

3. **이메일 인증 완료**

#### 2단계: API 키 확인

1. **대시보드 자동 접속**
   - 가입 완료 즉시 API 키가 생성됩니다

2. **API 키 복사**
   ```
   Dashboard > API Key 섹션
   예: api-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **무료 플랜 확인**
   - 300 호출/월
   - 파일 크기: 최대 50MB
   - PDF만 지원

---

## ⚙️ 시스템에 API 키 설정

### 방법 1: 관리자 페이지 (권장)

#### 1단계: 관리자 로그인

```
URL: https://your-deployment.pages.dev/admin
이메일: admin@example.com
비밀번호: admin123!@#
```

#### 2단계: API 설정 탭 이동

1. 상단 메뉴에서 **"API 설정"** 탭 클릭

2. **"문서 파싱 API 설정"** 섹션 찾기

#### 3단계: API 키 입력

**LlamaParse API Key (권장):**
```
llx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
- PDF, DOCX, PPTX 모두 지원
- 1000 페이지/일 무료

**PDF.co API Key (선택):**
```
api-key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
- PDF만 지원
- LlamaParse가 실패할 경우 백업으로 사용

#### 4단계: 저장

- **"저장"** 버튼 클릭
- 성공 메시지 확인: "문서 파싱 API 설정이 저장되었습니다."

---

### 방법 2: 데이터베이스 직접 삽입 (고급)

```bash
# LlamaParse 키 삽입
npx wrangler d1 execute webapp-production --remote --command="
INSERT OR REPLACE INTO api_settings (setting_key, setting_value, encrypted, updated_by) 
VALUES ('llamaparse_api_key', 'llx-YOUR-API-KEY', 0, 1)
"

# PDF.co 키 삽입
npx wrangler d1 execute webapp-production --remote --command="
INSERT OR REPLACE INTO api_settings (setting_key, setting_value, encrypted, updated_by) 
VALUES ('pdfco_api_key', 'YOUR-PDFCO-KEY', 0, 1)
"
```

---

## 🧪 테스트 및 검증

### 1. API 키 설정 확인

#### 관리자 페이지에서:
1. API 설정 탭 접속
2. API 키 입력란에 값이 표시되는지 확인 (보안상 마스킹됨)

#### 데이터베이스 확인:
```bash
npx wrangler d1 execute webapp-production --remote --command="
SELECT setting_key, 
       CASE WHEN length(setting_value) > 0 
            THEN '✅ 설정됨' 
            ELSE '❌ 미설정' 
       END as status
FROM api_settings 
WHERE setting_key IN ('llamaparse_api_key', 'pdfco_api_key')
"
```

### 2. 파일 업로드 테스트

#### 테스트 시나리오 1: PDF 업로드
1. 메인 페이지 로그인
2. 사이드바 "문서 업로드" 섹션
3. PDF 파일 선택 (테스트용: 1-2 페이지 짧은 PDF 권장)
4. "업로드" 버튼 클릭
5. **예상 결과**:
   - ✅ 업로드 진행률 표시: 30% → 60% → 100%
   - ✅ 성공 메시지: "문서가 성공적으로 업로드되었습니다!"
   - ✅ 시스템 정보에서 "등록된 문서" 숫자 증가

#### 테스트 시나리오 2: DOCX 업로드
1. Word 문서(.docx) 선택
2. 업로드
3. **예상 결과**:
   - ✅ LlamaParse 사용 (DOCX 지원)
   - ✅ 정상 처리 완료

#### 테스트 시나리오 3: PPTX 업로드
1. PowerPoint 파일(.pptx) 선택
2. 업로드
3. **예상 결과**:
   - ✅ LlamaParse 사용 (PPTX 지원)
   - ✅ 슬라이드 텍스트 추출 완료

### 3. 에러 시나리오 테스트

#### API 키 미설정 상태:
**예상 에러 메시지**:
```
⚠️ 문서 파싱 API가 설정되지 않았습니다.

⚙️ 관리자 설정 필요:
1. 관리자 페이지 접속
2. "API 설정" 탭
3. "문서 파싱 API" 섹션에서 API 키 입력

📝 지원되는 무료 API:
• LlamaParse (권장): PDF, DOCX, PPTX 모두 지원
• PDF.co: PDF 전용
```

#### LlamaParse만 설정 + DOCX 업로드:
- ✅ 정상 처리 (LlamaParse가 DOCX 지원)

#### PDF.co만 설정 + DOCX 업로드:
**예상 에러 메시지**:
```
⚠️ DOCX/PPTX 파일 파싱을 위해서는 LlamaParse API 키가 필요합니다.

현재: PDF.co API만 설정됨 (PDF 전용)

해결 방법:
1. LlamaParse API 키 발급 (무료)
2. 관리자 페이지 > API 설정에서 추가
3. 또는 파일을 PDF로 변환 후 업로드
```

---

## 💰 비용 및 사용량 관리

### LlamaParse 사용량 확인

1. **LlamaIndex Cloud Dashboard 접속**
   ```
   https://cloud.llamaindex.ai
   ```

2. **Usage 탭 확인**
   - 오늘 사용량: X / 1000 페이지
   - 리셋 시간: 매일 자정 (UTC)
   - 히스토리: 최근 30일 사용 내역

3. **알림 설정**
   - Dashboard > Settings > Notifications
   - 80% 도달 시 이메일 알림 설정 가능

### PDF.co 사용량 확인

1. **PDF.co Dashboard 접속**
   ```
   https://pdf.co/dashboard
   ```

2. **API Calls 확인**
   - 이번 달: X / 300 호출
   - 리셋: 매월 1일
   - 상세 로그: API Logs 메뉴

---

## 🔧 고급 설정

### 파싱 우선순위

시스템은 다음 순서로 API를 시도합니다:

```
1. LlamaParse (설정된 경우)
   ↓ 실패 시
2. PDF.co (PDF 파일이고 설정된 경우)
   ↓ 실패 시
3. 에러 메시지 반환
```

### 타임아웃 설정

**LlamaParse:**
- 최대 대기 시간: 60초
- 폴링 간격: 2초
- 최대 재시도: 30회

**PDF.co:**
- 최대 대기 시간: 30초
- 즉시 처리 (동기)

### 디버깅

파싱 로그 확인:
```bash
# 로컬 개발
pm2 logs webapp --nostream | grep -i "parsing\|llamaparse\|pdfco"

# 프로덕션 (Cloudflare)
npx wrangler tail --project-name webapp | grep -i "parsing"
```

---

## ❓ FAQ

### Q1: LlamaParse와 PDF.co 둘 다 설정해야 하나요?

**A:** 아니요. LlamaParse만 설정하면 충분합니다.
- LlamaParse는 PDF, DOCX, PPTX 모두 지원
- PDF.co는 백업용 (LlamaParse 실패 시만 사용)

---

### Q2: 무료 티어 한도를 초과하면 어떻게 되나요?

**LlamaParse:**
- 1000 페이지/일 초과 시 → 다음 날까지 대기
- 또는 유료 플랜 업그레이드

**PDF.co:**
- 300 호출/월 초과 시 → 다음 달까지 대기
- 또는 유료 플랜 업그레이드

**시스템 동작:**
- API 한도 초과 시 사용자에게 에러 메시지 표시
- TXT 파일 변환 가이드 제공

---

### Q3: API 키를 변경하려면?

1. 관리자 페이지 > API 설정
2. 새 API 키 입력
3. 저장 버튼 클릭
4. 즉시 반영됨 (재시작 불필요)

---

### Q4: 여러 개의 LlamaParse 키를 로테이션할 수 있나요?

현재는 하나의 키만 지원합니다. 로테이션이 필요한 경우:
1. 별도의 LlamaIndex 계정 생성
2. 각 계정마다 1000 페이지/일 할당
3. 수동으로 키 교체

---

### Q5: 한글 문서 파싱 품질은?

**LlamaParse:**
- ✅ 우수: 한글 PDF, DOCX 완벽 지원
- ✅ 정확도: 95%+ (깨끗한 문서 기준)

**PDF.co:**
- ⚠️ 보통: 한글 지원하지만 LlamaParse보다 낮음
- ✅ 정확도: 80-90%

---

### Q6: 이미지 기반 PDF (스캔본)도 처리되나요?

**아니요.** 현재는 텍스트 기반 PDF만 지원합니다.

**이미지 PDF 처리 방법:**
1. OCR 도구 사용 (Adobe Acrobat, Tesseract 등)
2. 텍스트 추출
3. TXT 파일로 저장
4. 업로드

**향후 계획:**
- Tesseract.js 통합
- Cloud Vision API 연동

---

## 📊 권장 설정

### 소규모 팀 (< 50명)
```
✅ LlamaParse 무료 플랜
   - 1000 페이지/일
   - 대부분의 사용에 충분

❌ PDF.co 불필요
```

### 중규모 조직 (50-200명)
```
✅ LlamaParse 유료 플랜 ($39/월)
   - 10,000 페이지/일
   - 안정적인 서비스

✅ PDF.co 무료 백업
   - 비상용
```

### 대규모 기업 (200명+)
```
✅ LlamaParse 프로 플랜
✅ PDF.co 유료 플랜
✅ 별도 파싱 서버 구축 검토
```

---

## 🚀 다음 단계

1. **API 키 발급 완료** ✅
2. **시스템 설정 완료** ✅
3. **테스트 업로드** ✅
4. **팀에 공유**
   - 사용 가능한 파일 형식
   - 업로드 방법
   - 문의처

---

## 📞 지원

문제가 발생하면:
1. 이 가이드의 FAQ 확인
2. 시스템 로그 확인
3. GitHub Issues에 문의
4. LlamaParse 공식 문서: https://docs.cloud.llamaindex.ai

---

**작성일**: 2025-11-11  
**버전**: 1.0  
**최신 배포 URL**: https://a9159615.webapp-31i.pages.dev

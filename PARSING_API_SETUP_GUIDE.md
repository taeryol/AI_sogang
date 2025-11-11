# 📄 문서 파싱 API 설정 가이드

PDF, DOCX, PPTX 파일을 업로드하고 처리하려면 LlamaParse API 키가 필요합니다.

## 🎯 LlamaParse API

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

## 📝 API 키 발급 방법

### 1단계: LlamaIndex 계정 생성

1. **LlamaIndex Cloud 접속**
   ```
   https://cloud.llamaindex.ai
   ```

2. **Sign Up 클릭**
   - Google, GitHub 계정으로 간편 가입 가능
   - 또는 이메일로 신규 가입

### 2단계: API 키 생성

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

### 3단계: 무료 플랜 확인

- **기본**: 1000 페이지/일 무료
- **Usage** 탭에서 사용량 확인 가능
- 초과 시 자동으로 다음 날 리셋

---

## ⚙️ API 키 설정 방법

### 방법 1: 웹 UI에서 설정 (권장)

1. **관리자 페이지 접속**
   ```
   https://your-domain.pages.dev/#admin
   ```

2. **로그인**
   - 관리자 계정으로 로그인

3. **API 설정 탭 선택**

4. **문서 파싱 API 섹션에서 LlamaParse API 키 입력**
   ```
   LlamaParse API Key: llx-xxxxxx...
   ```

5. **"저장" 버튼 클릭**

### 방법 2: 데이터베이스에 직접 삽입 (개발용)

```bash
# Local D1 database
cd /home/user/webapp
npx wrangler d1 execute webapp-production --local --command="
INSERT INTO api_settings (setting_key, setting_value, encrypted, updated_by)
VALUES ('llamaparse_api_key', 'YOUR-LLAMAPARSE-KEY', 0, 1)
ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
"

# Production D1 database
npx wrangler d1 execute webapp-production --command="
INSERT INTO api_settings (setting_key, setting_value, encrypted, updated_by)
VALUES ('llamaparse_api_key', 'YOUR-LLAMAPARSE-KEY', 0, 1)
ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
"
```

### 설정 확인

```bash
# Check local settings
npx wrangler d1 execute webapp-production --local --command="
SELECT setting_key, setting_value, updated_at 
FROM api_settings 
WHERE setting_key = 'llamaparse_api_key'
"

# Check production settings
npx wrangler d1 execute webapp-production --command="
SELECT setting_key, setting_value, updated_at 
FROM api_settings 
WHERE setting_key = 'llamaparse_api_key'
"
```

---

## 🚀 테스트

### 1. 파일 업로드 테스트

1. **메인 페이지 접속**

2. **문서 업로드 섹션에서 파일 선택**
   - PDF, DOCX, PPTX 등 지원

3. **업로드 버튼 클릭**

4. **성공 메시지 확인**
   ```
   ✅ 문서 업로드 성공! 백그라운드에서 처리 중입니다.
   ```

### 2. 에러 메시지 확인

**API 키 미설정 시:**
```
문서 파싱 API가 설정되지 않았습니다.

⚙️ 관리자 설정 필요:
1. 관리자 페이지 접속
2. "API 설정" 탭
3. "문서 파싱 API" 섹션에서 LlamaParse API 키 입력
```

**파싱 실패 시:**
```
문서 파싱에 실패했습니다. LlamaParse API 키를 확인하거나 다시 시도해주세요.
```

---

## 📊 사용량 모니터링

### LlamaParse 사용량 확인

1. **LlamaIndex Cloud Dashboard 접속**
   ```
   https://cloud.llamaindex.ai
   ```

2. **"Usage" 탭 클릭**
   - 오늘 사용량: X / 1000 페이지
   - 월간 사용량 그래프
   - API 호출 내역

3. **사용량 초과 시**
   - 다음 날 자동 리셋 (무료 플랜)
   - 유료 플랜 고려 ($39/월)

---

## 🔍 동작 원리

### 파싱 플로우

```
1. 사용자가 파일 업로드
   ↓
2. DocumentProcessor.extractText() 호출
   ↓
3. DocumentParserAPI.parseDocument() 호출
   ↓
4. LlamaParse API로 파일 전송
   ↓
5. 파싱 완료 대기 (폴링, 최대 60초)
   ↓
6. 추출된 텍스트 반환
   ↓
7. 청킹 및 벡터 임베딩
   ↓
8. D1 Database 저장
```

### 로그 확인

```bash
# PM2 logs
pm2 logs webapp --nostream | grep -i "parsing\|llamaparse"

# Expected output:
# [Documents] Attempting to parse with LlamaParse...
# [Documents] LlamaParse successful
# [Documents] Extracted 1234 characters from document
```

---

## ❓ FAQ

### Q1: API 키는 어디에 저장되나요?

**A:** Cloudflare D1 Database의 `api_settings` 테이블에 저장됩니다. 환경 변수가 아닌 데이터베이스에 저장되어 웹 UI에서 관리가 가능합니다.

### Q2: 무료 한도를 초과하면 어떻게 되나요?

**A:** 
- **LlamaParse**: 다음 날 자동 리셋 (1000 페이지/일)
- 유료 플랜 고려 시: $39/월로 10,000 페이지/일

### Q3: 지원하는 파일 형식은?

**A:** 
- **LlamaParse**: PDF, DOCX, PPTX, HTML, MD, TXT
- 최대 파일 크기: 10MB

### Q4: 파싱이 실패하면?

**A:** 
1. API 키 확인 (관리자 페이지 > API 설정)
2. 사용량 한도 확인 (LlamaIndex Dashboard)
3. 파일 크기 확인 (10MB 이하)
4. 파일 형식 확인 (지원 형식)
5. 로그 확인: `pm2 logs webapp --nostream`

### Q5: 민감한 문서를 업로드해도 안전한가요?

**A:** 
- LlamaParse는 외부 API이므로 파일이 외부 서버로 전송됩니다
- 민감한 문서는 사내 파싱 솔루션 사용을 권장합니다
- LlamaIndex의 보안 정책: https://www.llamaindex.ai/privacy

---

## 📚 참고 자료

- **LlamaParse 공식 문서**: https://docs.llamaindex.ai/en/stable/llama_cloud/llama_parse/
- **LlamaIndex Cloud**: https://cloud.llamaindex.ai
- **API Reference**: https://docs.cloud.llamaindex.ai/

---

## 🛠️ 트러블슈팅

### 에러: "LlamaParse upload failed"

**원인**: 잘못된 API 키 또는 네트워크 오류

**해결**:
```bash
# 1. API 키 확인
npx wrangler d1 execute webapp-production --local --command="
SELECT setting_value FROM api_settings WHERE setting_key = 'llamaparse_api_key'
"

# 2. API 키 재설정 (웹 UI 또는 SQL)
# 웹 UI: 관리자 > API 설정 > LlamaParse API Key 재입력

# 3. 서비스 재시작
fuser -k 3000/tcp 2>/dev/null || true
cd /home/user/webapp && npm run build
pm2 start ecosystem.config.cjs
```

### 에러: "Parsing timeout (60 seconds exceeded)"

**원인**: 파일이 너무 크거나 복잡함

**해결**:
1. 파일 크기 줄이기 (10MB 이하 권장)
2. 복잡한 레이아웃의 경우 PDF로 변환 후 업로드
3. 페이지 수가 많은 경우 분할 업로드

### 에러: "API 키가 설정되지 않았습니다"

**원인**: 데이터베이스에 API 키가 없음

**해결**:
```bash
# 웹 UI에서 설정 (권장)
# 또는 SQL 직접 실행
npx wrangler d1 execute webapp-production --local --command="
INSERT INTO api_settings (setting_key, setting_value, encrypted, updated_by)
VALUES ('llamaparse_api_key', 'llx-YOUR-KEY-HERE', 0, 1)
ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
"
```

---

**작성일**: 2024-01-15
**최종 수정**: 2024-01-15
**문서 버전**: 2.0 (PDF.co 제거, LlamaParse 단독 사용)

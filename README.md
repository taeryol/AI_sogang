# MindBase – AI 에이전트 기반 지식 관리 시스템

MindBase는 기획서의 요구사항을 충실히 반영한 **검색 증강 생성(RAG)** 기반 지식 관리 시스템입니다. Flask로 구현된 웹 애플리케이션과 하이브리드 검색 엔진(Whoosh + FAISS)을 통해 사내 문서를 업로드하고, 자연어 질문으로 즉시 답변을 받을 수 있습니다. 관리자 전용 대시보드를 제공하여 지식베이스 상태와 사용 현황을 모니터링할 수 있습니다.

## 주요 기능

- **문서 업로드 및 자동 인덱싱**: TXT, MD, PDF, CSV, DOCX 파일을 업로드하면 자동으로 전처리하여 키워드/벡터 인덱스를 동시에 생성합니다.
- **하이브리드 검색 + LLM**: BM25 기반 키워드 검색과 Sentence-BERT + FAISS 기반 의미 검색을 조합해 관련 문서 조각을 찾고, HuggingFace 또는 OpenAI LLM이 근거 기반 답변을 생성합니다.
- **출처가 포함된 Q&A**: 답변과 함께 사용된 문서 조각, 점수, 파일 경로를 제공하여 신뢰성을 보장합니다.
- **관리자 대시보드**: 업로드된 문서 목록, 누적 질문 수, 평균 응답 속도, 최근 질문 내역 등 운영에 필요한 지표를 한눈에 확인할 수 있습니다.

## 설치 및 실행

### 1. 환경 준비

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
```

### 1-1. macOS 빠른 시작 (Apple Silicon 포함)

macOS에서는 기본 `python` 명령이 2.x일 수 있으므로 **python3**를 명시하세요.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

> 💡  Apple Silicon(M1/M2)에서 `sentence-transformers`가 내부적으로 PyTorch를 설치하며,
> `pip install torch`가 오래 걸릴 수 있습니다. 설치 중 중단되면 `pip install --upgrade pip setuptools wheel`
> 후 재시도하세요.

벡터 검색 가속화를 위해 `faiss-cpu`를 추가로 설치할 수 있습니다. 설치가 실패해도 MindBase는
내장된 NumPy 기반 검색으로 자동 전환되므로 바로 사용 가능합니다.

```bash
pip install faiss-cpu  # 선택 사항
```

### 2. 웹 애플리케이션 실행

```bash
flask --app kms_app.webapp run --debug
```

브라우저에서 `http://127.0.0.1:5000`으로 접속하면 MindBase UI가 열립니다. 홈 화면에서 문서를 업로드하고 질문을 입력하면 답변을 확인할 수 있습니다.

macOS에서 포트를 변경하고 싶다면 `flask --app kms_app.webapp run --debug --port 8000`처럼 `--port` 옵션을 추가하세요.

### 3. OpenAI API 연동(선택)

기본값은 오픈소스 HuggingFace 모델(`google/flan-t5-base`)입니다. OpenAI GPT 계열 모델을 사용하려면 다음을 설정하세요.

```bash
pip install openai
export OPENAI_API_KEY="sk-..."  # Windows PowerShell: setx OPENAI_API_KEY "sk-..."
```

`kms_app/config.py`에서 `llm_backend="openai"`로 변경하면 OpenAI ChatCompletion API를 사용합니다.

### 4. GitHub에 소스 업로드하기

MindBase를 사내 GitHub 또는 개인 저장소에 업로드하려면 아래 절차를 따르세요.

1. GitHub에서 새 원격 저장소를 생성합니다.
2. 현재 프로젝트 루트에서 기본 브랜치를 확인하고 초기 커밋을 완료합니다.

   ```bash
   git status
   git add .
   git commit -m "Initial MindBase commit"
   ```

3. 원격 저장소를 등록하고 코드를 푸시합니다.

   ```bash
   git remote add origin https://github.com/<username>/<repository>.git
   git push -u origin $(git branch --show-current)
   ```

4. GitHub 웹 UI에서 README, 화면 스크린샷, 사용 가이드를 보강하면 온보딩이 더 수월해집니다.

## 프로젝트 구조

```
kms_app/
├── __init__.py
├── app.py                 # (선택) 기존 Tkinter 데스크톱 런처
├── config.py              # 글로벌 설정 및 경로 관리
├── document_loader.py     # 문서 수집, 전처리, 청킹
├── indexer.py             # Whoosh + FAISS 하이브리드 인덱스
├── knowledge_base.py      # 인덱싱/통계/QA 서비스 계층
├── llm.py                 # HuggingFace & OpenAI LLM 래퍼
├── webapp.py              # Flask 애플리케이션 팩토리
├── templates/             # Jinja2 템플릿 (사용자 홈, 관리자 대시보드)
└── static/                # UI 스타일 자산
requirements.txt           # 의존성 목록
```

## 운영 팁

- 인덱싱 결과와 업로드 파일은 사용자 홈 디렉터리의 `.kms_app/` 폴더에 저장됩니다. 필요 시 백업하거나 주기적으로 정리하세요.
- 대량 문서를 처리할 때는 SentenceTransformer 모델을 GPU 가속 가능한 모델로 교체해 성능을 높일 수 있습니다.
- HuggingFace 모델 로딩 시간이 길다면, 서버 기동 시점에 미리 Warm-up 요청을 보내는 것이 좋습니다.
- OpenAI 대신 사내 LLM을 사용하려면 `LLMClient`에 새로운 백엔드를 추가하면 됩니다.

## 로드맵 매핑

- **단계 1~3**: 현재 구현으로 RAG 파이프라인·하이브리드 검색·LLM 품질 튜닝을 즉시 검증할 수 있습니다.
- **단계 4**: Flask UI가 MVP 역할을 수행하며 사용자 피드백을 빠르게 수집할 수 있습니다.
- **단계 5**: 관리자 대시보드에서 수집한 질문 로그와 성능 지표를 바탕으로 개선 사항을 파악할 수 있습니다.
- **단계 6**: Docker 또는 가상환경을 활용해 온프레미스/클라우드 어디서든 배포 가능합니다.

## 라이선스

이 프로젝트는 교육용 예제로 제공됩니다. 상용 도입 시 각 라이브러리의 라이선스를 확인하세요.

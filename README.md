# 차세대 지능형 KMS 데스크톱 앱

이 저장소는 기획서에 명시된 **검색 증강 생성(RAG)** 기반 지식 관리 시스템을 윈도우 환경에서 바로 실행할 수 있는 데스크톱 애플리케이션(Tkinter)으로 구현합니다. 사용자는 로컬 폴더를 그대로 마운트해 문서들을 인덱싱하고, 자연어 질문에 대해 하이브리드 검색(키워드 + 벡터)과 LLM 답변 생성을 통해 정확한 답변을 받을 수 있습니다.

## 주요 기능

- **폴더 단위 문서 마운트**: `폴더 선택` 버튼으로 사내 문서 폴더를 지정하면 TXT/MD/PDF/CSV/DOCX 파일을 자동으로 수집하고 전처리합니다.
- **하이브리드 검색**: Whoosh 기반 키워드 검색과 FAISS + SentenceTransformer 기반 벡터 검색을 동시에 수행하여 높은 검색 정밀도와 재현율을 제공합니다.
- **LLM 답변 생성**: 추출한 문맥을 바탕으로 HuggingFace 모델(기본값: `google/flan-t5-base`) 또는 OpenAI API를 활용해 근거 중심 답변을 제공합니다.
- **투명한 출처 제공**: 답변과 함께 사용된 문서 조각과 점수를 표시해 환각을 최소화하고 신뢰성을 높였습니다.

## 설치 및 실행 (Windows 10/11 기준)

1. **Python 설치**: Python 3.10 이상을 [공식 웹사이트](https://www.python.org/downloads/windows/)에서 설치합니다. 설치 시 "Add Python to PATH" 옵션을 활성화하세요.
2. **가상환경 생성(선택)**:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\activate
   ```
3. **필수 라이브러리 설치**:
   ```powershell
   pip install -r requirements.txt
   ```
4. **애플리케이션 실행**:
   ```powershell
   python -m kms_app.app
   ```
   실행 후 나타나는 창에서 `폴더 선택` 버튼을 눌러 문서 폴더를 마운트하고, 질문을 입력해 결과를 확인합니다.

## 윈도우 실행 파일 패키징(PyInstaller)

Python 환경이 준비돼 있다면 `PyInstaller`로 단일 실행 파일을 만들 수 있습니다. 아래 절차를 권장합니다.

1. **빌드 준비**: 애플리케이션이 최초 실행 시 필요로 하는 SentenceTransformer 모델 등을 다운로드해 두면, 패키징 후 첫 실행 속도가 빨라집니다.
2. **PyInstaller 설치**:
   ```powershell
   pip install pyinstaller
   ```
3. **실행 파일 생성**: 프로젝트 루트에서 다음 명령을 실행합니다. `-w` 옵션은 콘솔 창을 숨기고, `--add-data`는 애플리케이션 설정 기본값을 포함합니다.
   ```powershell
   pyinstaller -F -w kms_app\app.py --name KMSApp --add-data "kms_app\config.py;kms_app"
   ```
4. **산출물 확인**: `dist\KMSApp.exe`가 생성되며, 같은 폴더에 `kms_app` 디렉터리와 인덱스 캐시(`%USERPROFILE%\.kms_app`)가 자동으로 만들어집니다. 배포 시 `dist` 폴더를 통째로 전달하세요.

필요에 따라 `--add-data` 옵션에 사내에서 사용하는 기본 템플릿, 아이콘(`--icon`) 등을 추가할 수 있습니다. PyInstaller의 고급 옵션은 [공식 문서](https://pyinstaller.org/en/stable/usage.html)를 참고하세요.

### OpenAI API 사용 (선택)

기본 설정은 오픈소스 LLM(HuggingFace)입니다. OpenAI GPT-4 계열 모델을 사용하려면 다음을 추가 설정하세요.

1. OpenAI Python SDK 설치:
   ```powershell
   pip install openai
   ```
2. 환경 변수 설정 (PowerShell 예시):
   ```powershell
   setx OPENAI_API_KEY "sk-..."
   ```
3. `kms_app/config.py`에서 `llm_backend="openai"`로 변경하거나 실행 시 환경 변수로 덮어쓸 수 있습니다.

## 프로젝트 구조

```
kms_app/
├── __init__.py
├── app.py                 # Tkinter 기반 데스크톱 UI
├── config.py              # 전역 설정 및 경로 관리
├── document_loader.py     # 문서 수집, 전처리, 청킹
├── indexer.py             # Whoosh + FAISS 하이브리드 인덱스
└── llm.py                 # HuggingFace/OpenAI LLM 래퍼
requirements.txt           # 의존성 목록
```

## 개발 로드맵 반영

- **1단계 (PoC)**: 소수 문서로 전처리-검색-생성 파이프라인을 검증할 수 있습니다.
- **2단계**: 폴더 확장 시 자동으로 추가 문서를 인덱싱하여 정확도 향상.
- **3단계**: LLM 출력 품질을 높이기 위해 `config.py`에서 프롬프트/모델을 변경.
- **4단계**: 현재 Tkinter UI가 MVP 역할을 수행하여 현업 사용자가 직접 테스트 가능.
- **5단계**: 파일럿 피드백을 통해 전처리 규칙, 하이브리드 가중치 조정.
- **6단계**: 로컬 서버나 사내 PC에 배포하여 안정적인 운영이 가능합니다.

## 추가 팁

- 대량 문서 인덱싱 시 GPU 가속 SentenceTransformer 모델로 교체하면 속도를 높일 수 있습니다.
- 인덱싱 결과는 사용자 홈 디렉터리의 `.kms_app/` 폴더에 저장되므로 반복 실행 시 재사용됩니다.
- 보안을 위해 사내 전용 네트워크에서 실행하거나, 온프레미스 LLM을 연결할 수 있도록 구조를 단순하게 유지했습니다.

## 라이선스

이 프로젝트는 교육용 예제로 제공됩니다. 상용 환경에 적용 시 각 라이브러리의 라이선스를 확인하세요.

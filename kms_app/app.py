"""Tkinter desktop application for the intelligent KMS."""
from __future__ import annotations

import logging
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext

from .config import AppConfig, ensure_directories
from .document_loader import build_chunks_from_directory
from .indexer import HybridIndex
from .llm import LLMClient

LOGGER = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class KMSApplication(tk.Tk):
    def __init__(self, config: AppConfig | None = None) -> None:
        super().__init__()
        self.title("Intelligent Knowledge Management System")
        self.geometry("900x700")

        self.config_obj = config or AppConfig()
        ensure_directories(self.config_obj)

        self.index = HybridIndex(self.config_obj)
        self._llm_client: LLMClient | None = None
        self._current_folder: Path | None = None

        self._build_widgets()

    # ------------------------------------------------------------------
    def _build_widgets(self) -> None:
        top_frame = tk.Frame(self)
        top_frame.pack(fill=tk.X, padx=10, pady=5)

        self.folder_label = tk.Label(top_frame, text="선택된 폴더: 없음", anchor="w")
        self.folder_label.pack(side=tk.LEFT, expand=True, fill=tk.X)

        select_btn = tk.Button(top_frame, text="폴더 선택", command=self.select_folder)
        select_btn.pack(side=tk.RIGHT)

        self.status_box = scrolledtext.ScrolledText(self, height=10, state=tk.DISABLED)
        self.status_box.pack(fill=tk.BOTH, padx=10, pady=5)

        query_frame = tk.Frame(self)
        query_frame.pack(fill=tk.X, padx=10, pady=5)

        tk.Label(query_frame, text="질문 입력:").pack(anchor="w")
        self.question_entry = tk.Text(query_frame, height=4)
        self.question_entry.pack(fill=tk.X)

        ask_btn = tk.Button(self, text="질문 실행", command=self.ask_question)
        ask_btn.pack(pady=5)

        tk.Label(self, text="답변:").pack(anchor="w", padx=10)
        self.answer_box = scrolledtext.ScrolledText(self, height=12, state=tk.DISABLED)
        self.answer_box.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        tk.Label(self, text="출처 문서 조각:").pack(anchor="w", padx=10)
        self.context_box = scrolledtext.ScrolledText(self, height=12, state=tk.DISABLED)
        self.context_box.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

    # ------------------------------------------------------------------
    def log(self, message: str) -> None:
        self.status_box.configure(state=tk.NORMAL)
        self.status_box.insert(tk.END, message + "\n")
        self.status_box.configure(state=tk.DISABLED)
        self.status_box.see(tk.END)
        LOGGER.info(message)

    # ------------------------------------------------------------------
    def select_folder(self) -> None:
        folder = filedialog.askdirectory(title="문서 폴더 선택")
        if folder:
            path = Path(folder)
            self.folder_label.configure(text=f"선택된 폴더: {path}")
            self._current_folder = path
            threading.Thread(target=self._ingest_folder, args=(path,), daemon=True).start()

    def _ingest_folder(self, folder: Path) -> None:
        try:
            self.log(f"문서 전처리 및 인덱싱 시작: {folder}")
            chunks = list(
                build_chunks_from_directory(
                    directory=folder,
                    chunk_size=self.config_obj.chunk_size,
                    overlap=self.config_obj.chunk_overlap,
                )
            )
            if not chunks:
                self.log("처리 가능한 문서가 없습니다. 지원되는 확장자를 확인하세요.")
                return
            self.index.reset()
            self.index.ingest(chunks)
            self.log(f"총 {len(chunks)}개의 문서 조각이 인덱싱되었습니다.")
        except Exception as exc:  # pragma: no cover - UI feedback
            self.log(f"인덱싱 실패: {exc}")
            messagebox.showerror("오류", f"인덱싱 중 오류 발생: {exc}")

    # ------------------------------------------------------------------
    def _get_llm_client(self) -> LLMClient:
        if self._llm_client is None:
            try:
                self.log("LLM 초기화 중...")
                self._llm_client = LLMClient(self.config_obj)
                self.log("LLM 준비 완료")
            except Exception as exc:  # pragma: no cover - UI feedback
                self.log(f"LLM 초기화 실패: {exc}")
                messagebox.showerror("오류", f"LLM 초기화 중 오류 발생: {exc}")
                raise
        return self._llm_client

    def ask_question(self) -> None:
        question = self.question_entry.get("1.0", tk.END).strip()
        if not question:
            messagebox.showinfo("알림", "질문을 입력하세요.")
            return
        threading.Thread(target=self._run_query, args=(question,), daemon=True).start()

    def _run_query(self, question: str) -> None:
        try:
            self.log(f"질문 수신: {question}")
            results = self.index.search(question, top_k=5)
            if not results:
                self.log("검색 결과가 없습니다. 다른 질문을 시도하세요.")
                return
            contexts = [res.content for res in results]
            answer = self._get_llm_client().generate_answer(question, contexts)
            self._display_answer(answer, results)
        except Exception as exc:  # pragma: no cover - UI feedback
            self.log(f"질문 처리 실패: {exc}")
            messagebox.showerror("오류", f"질문 처리 중 오류 발생: {exc}")

    def _display_answer(self, answer: str, results) -> None:
        self.answer_box.configure(state=tk.NORMAL)
        self.answer_box.delete("1.0", tk.END)
        self.answer_box.insert(tk.END, answer)
        self.answer_box.configure(state=tk.DISABLED)

        self.context_box.configure(state=tk.NORMAL)
        self.context_box.delete("1.0", tk.END)
        for idx, result in enumerate(results, start=1):
            source = result.metadata.get("source", "Unknown")
            chunk_id = result.metadata.get("chunk_id", "?")
            self.context_box.insert(
                tk.END,
                f"[{idx}] {source} (chunk {chunk_id})\n점수: {result.score:.3f}\n{result.content}\n\n",
            )
        self.context_box.configure(state=tk.DISABLED)


def launch_app() -> None:
    app = KMSApplication()
    app.mainloop()


if __name__ == "__main__":  # pragma: no cover
    launch_app()

"""High level services that orchestrate ingestion, search, and analytics."""
from __future__ import annotations

import json
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from .config import AppConfig, ensure_directories
from .document_loader import SUPPORTED_EXTENSIONS, build_chunks_from_directory
from .indexer import HybridIndex, SearchResult
from .llm import LLMClient

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class UsageStats:
    """Runtime analytics for administrator dashboards."""

    total_documents: int = 0
    total_chunks: int = 0
    total_queries: int = 0
    average_latency_ms: float = 0.0
    last_ingested_at: str | None = None
    recent_questions: deque[str] = field(default_factory=lambda: deque(maxlen=10))

    @classmethod
    def from_dict(cls, data: dict) -> "UsageStats":
        recent = deque(data.get("recent_questions", []), maxlen=10)
        return cls(
            total_documents=int(data.get("total_documents", 0)),
            total_chunks=int(data.get("total_chunks", 0)),
            total_queries=int(data.get("total_queries", 0)),
            average_latency_ms=float(data.get("average_latency_ms", 0.0)),
            last_ingested_at=data.get("last_ingested_at"),
            recent_questions=recent,
        )

    def to_dict(self) -> dict:
        return {
            "total_documents": self.total_documents,
            "total_chunks": self.total_chunks,
            "total_queries": self.total_queries,
            "average_latency_ms": self.average_latency_ms,
            "last_ingested_at": self.last_ingested_at,
            "recent_questions": list(self.recent_questions),
        }

    # ------------------------------------------------------------------
    def record_ingest(self, document_count: int, chunk_count: int) -> None:
        self.total_documents = document_count
        self.total_chunks = chunk_count
        self.last_ingested_at = datetime.utcnow().isoformat(timespec="seconds")

    def record_query(self, question: str, duration_seconds: float) -> None:
        self.total_queries += 1
        latency_ms = duration_seconds * 1000
        if self.total_queries == 1:
            self.average_latency_ms = latency_ms
        else:
            self.average_latency_ms = (
                self.average_latency_ms * (self.total_queries - 1) + latency_ms
            ) / self.total_queries
        if question:
            self.recent_questions.appendleft(question)


class KnowledgeBaseService:
    """Facade over the hybrid index and LLM with persistence helpers."""

    def __init__(self, config: AppConfig | None = None) -> None:
        self.config = config or AppConfig()
        ensure_directories(self.config)
        self.index = HybridIndex(self.config)
        self._llm_client: LLMClient | None = None
        self._lock = threading.Lock()
        self._stats = self._load_stats()

    # ------------------------------------------------------------------
    # Utility helpers
    def _load_stats(self) -> UsageStats:
        if self.config.stats_store_path.exists():
            try:
                data = json.loads(
                    self.config.stats_store_path.read_text(encoding="utf-8")
                )
                return UsageStats.from_dict(data)
            except Exception as exc:  # pragma: no cover - defensive parsing
                LOGGER.warning("Failed to load stats, starting fresh: %s", exc)
        return UsageStats()

    def _persist_stats(self) -> None:
        payload = json.dumps(self._stats.to_dict(), ensure_ascii=False, indent=2)
        self.config.stats_store_path.write_text(payload, encoding="utf-8")

    def _get_llm(self) -> LLMClient:
        if self._llm_client is None:
            LOGGER.info("Initialising LLM backend")
            self._llm_client = LLMClient(self.config)
        return self._llm_client

    # ------------------------------------------------------------------
    # Document ingestion
    def save_and_index(self, files: Iterable[FileStorage]) -> Tuple[int, int]:
        """Persist uploaded files and rebuild the hybrid index."""

        saved_paths: List[Path] = []
        for storage in files:
            if not storage or not storage.filename:
                continue
            safe_name = secure_filename(storage.filename)
            if not safe_name:
                continue
            if Path(safe_name).suffix.lower() not in SUPPORTED_EXTENSIONS:
                LOGGER.warning("Unsupported file skipped: %s", storage.filename)
                continue
            target = self._resolve_unique_path(safe_name)
            storage.save(target)
            saved_paths.append(target)
        if not saved_paths:
            return 0, 0
        chunk_count = self.rebuild_index()
        return len(saved_paths), chunk_count

    def rebuild_index(self) -> int:
        """Rebuild the hybrid index from the uploads directory."""

        with self._lock:
            chunk_list = list(
                build_chunks_from_directory(
                    directory=self.config.uploads_dir,
                    chunk_size=self.config.chunk_size,
                    overlap=self.config.chunk_overlap,
                )
            )
            if not chunk_list:
                LOGGER.warning("No documents found during indexing.")
                self.index.reset()
                self._stats.record_ingest(0, 0)
                self._persist_stats()
                return 0

            self.index.reset()
            self.index.ingest(chunk_list)
            doc_count = len({chunk.source_path.resolve() for chunk in chunk_list})
            self._stats.record_ingest(doc_count, len(chunk_list))
            self._persist_stats()
            return len(chunk_list)

    def _resolve_unique_path(self, filename: str) -> Path:
        target = self.config.uploads_dir / filename
        if not target.exists():
            return target
        stem = target.stem
        suffix = target.suffix
        counter = 1
        while True:
            candidate = self.config.uploads_dir / f"{stem}_{counter}{suffix}"
            if not candidate.exists():
                return candidate
            counter += 1

    # ------------------------------------------------------------------
    # Question answering
    def answer_question(self, question: str, top_k: int = 5) -> Tuple[str, Sequence[SearchResult]]:
        start = time.perf_counter()
        with self._lock:
            results = self.index.search(question, top_k=top_k)
            if not results:
                return "", []
            contexts = [res.content for res in results]
            answer = self._get_llm().generate_answer(question, contexts)
        duration = time.perf_counter() - start
        self._stats.record_query(question, duration)
        self._persist_stats()
        return answer, results

    # ------------------------------------------------------------------
    # Administration helpers
    def stats_snapshot(self) -> dict:
        stats = self._stats.to_dict()
        stats["average_latency_ms"] = round(stats["average_latency_ms"], 2)
        return stats

    def list_documents(self) -> List[dict[str, str]]:
        documents: List[dict[str, str]] = []
        for path in sorted(self.config.uploads_dir.glob("*")):
            if not path.is_file():
                continue
            stat = path.stat()
            documents.append(
                {
                    "name": path.name,
                    "size": self._format_bytes(stat.st_size),
                    "modified": datetime.fromtimestamp(stat.st_mtime).strftime(
                        "%Y-%m-%d %H:%M"
                    ),
                }
            )
        return documents

    @staticmethod
    def _format_bytes(num_bytes: int) -> str:
        units = ["B", "KB", "MB", "GB"]
        size = float(num_bytes)
        for unit in units:
            if size < 1024.0 or unit == units[-1]:
                return f"{size:.1f} {unit}"
            size /= 1024.0


"""Application configuration utilities."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


LLMBackend = Literal["openai", "huggingface"]


def _default_data_dir() -> Path:
    return Path.home() / ".kms_app"


@dataclass(slots=True)
class AppConfig:
    """Global configuration for the desktop application."""

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    chunk_size: int = 500
    chunk_overlap: int = 50
    whoosh_index_dir: Path = _default_data_dir() / "whoosh_index"
    faiss_index_path: Path = _default_data_dir() / "faiss.index"
    vector_store_path: Path = _default_data_dir() / "embeddings.npy"
    metadata_store_path: Path = _default_data_dir() / "metadata.json"
    uploads_dir: Path = _default_data_dir() / "uploads"
    stats_store_path: Path = _default_data_dir() / "stats.json"
    llm_backend: LLMBackend = "huggingface"
    hf_model: str = "google/flan-t5-base"

    @property
    def openai_api_key(self) -> str | None:
        return os.getenv("OPENAI_API_KEY")

    def resolve_backend(self) -> LLMBackend:
        if self.llm_backend == "openai" and not self.openai_api_key:
            raise ValueError(
                "OpenAI backend selected but OPENAI_API_KEY is not configured."
            )
        return self.llm_backend


def ensure_directories(config: AppConfig) -> None:
    """Ensure that the directories required by the application exist."""

    config.whoosh_index_dir.mkdir(parents=True, exist_ok=True)
    config.metadata_store_path.parent.mkdir(parents=True, exist_ok=True)
    config.uploads_dir.mkdir(parents=True, exist_ok=True)
    config.vector_store_path.parent.mkdir(parents=True, exist_ok=True)

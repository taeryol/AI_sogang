"""Utilities for loading and chunking local documents."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, List

import pandas as pd
from PyPDF2 import PdfReader

try:  # Optional dependency
    import docx  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    docx = None

LOGGER = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf", ".csv", ".docx"}


@dataclass(slots=True)
class DocumentChunk:
    """Representation of a text chunk."""

    content: str
    source_path: Path
    chunk_id: int

    @property
    def metadata(self) -> dict[str, str]:
        return {
            "source": str(self.source_path),
            "chunk_id": str(self.chunk_id),
        }


def iter_files(root: Path) -> Iterator[Path]:
    for path in sorted(root.rglob("*")):
        if path.suffix.lower() in SUPPORTED_EXTENSIONS and path.is_file():
            yield path


def load_text_from_file(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in {".txt", ".md"}:
        return path.read_text(encoding="utf-8", errors="ignore")
    if ext == ".pdf":
        reader = PdfReader(str(path))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return text
    if ext == ".csv":
        df = pd.read_csv(path)
        return df.to_csv(index=False)
    if ext == ".docx" and docx:
        doc = docx.Document(str(path))
        return "\n".join(p.text for p in doc.paragraphs)
    raise ValueError(f"Unsupported file type or missing dependency: {ext}")


def chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    chunks: List[str] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chunk_size, length)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += chunk_size - overlap
        if start < 0:
            break
    return chunks


def build_chunks_from_directory(
    directory: Path, chunk_size: int, overlap: int
) -> Iterable[DocumentChunk]:
    if not directory.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")

    for file_path in iter_files(directory):
        try:
            text = load_text_from_file(file_path)
        except Exception as exc:  # pragma: no cover - defensive
            LOGGER.warning("Failed to load %s: %s", file_path, exc)
            continue
        pieces = chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        for idx, piece in enumerate(pieces):
            yield DocumentChunk(content=piece, source_path=file_path, chunk_id=idx)


def serialize_metadata(chunks: Iterable[DocumentChunk]) -> str:
    metadata = [chunk.metadata for chunk in chunks]
    return json.dumps(metadata, ensure_ascii=False, indent=2)

"""Hybrid index built on Whoosh (keyword) and FAISS (vector)."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from whoosh import index
from whoosh.fields import ID, NUMERIC, Schema, TEXT
from whoosh.qparser import MultifieldParser

from .config import AppConfig, ensure_directories
from .document_loader import DocumentChunk

LOGGER = logging.getLogger(__name__)

KEYWORD_WEIGHT = 0.6
VECTOR_WEIGHT = 0.4


@dataclass(slots=True)
class SearchResult:
    doc_id: int
    score: float
    content: str
    metadata: Dict[str, str]


class HybridIndex:
    """Manage keyword and vector indices as a unified retrieval interface."""

    def __init__(self, config: AppConfig) -> None:
        ensure_directories(config)
        self.config = config
        self._model: SentenceTransformer | None = None

    # ------------------------------------------------------------------
    # Index management
    def reset(self) -> None:
        """Delete all stored indices and metadata."""

        if self.config.whoosh_index_dir.exists():
            for child in self.config.whoosh_index_dir.iterdir():
                child.unlink()
        if self.config.faiss_index_path.exists():
            self.config.faiss_index_path.unlink()
        if self.config.metadata_store_path.exists():
            self.config.metadata_store_path.unlink()

    def _ensure_keyword_index(self) -> index.Index:
        schema = Schema(
            doc_id=NUMERIC(stored=True, unique=True),
            path=ID(stored=True),
            chunk_id=NUMERIC(stored=True),
            content=TEXT(stored=True),
        )
        if not self.config.whoosh_index_dir.exists():
            self.config.whoosh_index_dir.mkdir(parents=True)
        if not index.exists_in(self.config.whoosh_index_dir):
            return index.create_in(self.config.whoosh_index_dir, schema)
        return index.open_dir(self.config.whoosh_index_dir)

    def _load_model(self) -> SentenceTransformer:
        if self._model is None:
            LOGGER.info("Loading embedding model %s", self.config.embedding_model)
            self._model = SentenceTransformer(self.config.embedding_model)
        return self._model

    # ------------------------------------------------------------------
    def ingest(self, chunks: Iterable[DocumentChunk]) -> None:
        """Add chunks to both indices."""

        chunk_list = list(chunks)
        if not chunk_list:
            LOGGER.warning("No document chunks provided; skipping ingestion")
            return

        LOGGER.info("Indexing %d chunks", len(chunk_list))

        kw_index = self._ensure_keyword_index()
        writer = kw_index.writer()

        embeddings: List[np.ndarray] = []
        metadata: List[dict[str, str]] = []
        contents: List[str] = []

        for doc_id, chunk in enumerate(chunk_list):
            writer.update_document(
                doc_id=doc_id,
                path=str(chunk.source_path),
                chunk_id=chunk.chunk_id,
                content=chunk.content,
            )
            metadata.append(chunk.metadata)
            contents.append(chunk.content)

        writer.commit()

        model = self._load_model()
        embeddings = model.encode(
            [chunk.content for chunk in chunk_list],
            show_progress_bar=False,
            convert_to_numpy=True,
        )

        embeddings = np.asarray(embeddings, dtype="float32")
        faiss.normalize_L2(embeddings)

        index_flat = faiss.IndexFlatIP(embeddings.shape[1])
        index_flat.add(embeddings)
        faiss.write_index(index_flat, str(self.config.faiss_index_path))

        store = [
            {
                "doc_id": idx,
                "metadata": metadata[idx],
                "content": contents[idx],
            }
            for idx in range(len(metadata))
        ]
        self.config.metadata_store_path.write_text(
            json.dumps(store, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    # ------------------------------------------------------------------
    def _load_metadata(self) -> List[dict]:
        if not self.config.metadata_store_path.exists():
            raise FileNotFoundError(
                "Metadata store not found. Please ingest documents first."
            )
        text = self.config.metadata_store_path.read_text(encoding="utf-8")
        return json.loads(text)

    def _keyword_search(self, query: str, limit: int) -> List[Tuple[int, float]]:
        kw_index = self._ensure_keyword_index()
        with kw_index.searcher() as searcher:
            parser = MultifieldParser(["content"], schema=kw_index.schema)
            q = parser.parse(query)
            results = searcher.search(q, limit=limit)
            return [(int(r["doc_id"]), float(r.score)) for r in results]

    def _vector_search(self, query: str, limit: int) -> List[Tuple[int, float]]:
        if not self.config.faiss_index_path.exists():
            raise FileNotFoundError("Vector index not found. Please ingest documents first.")
        faiss_index = faiss.read_index(str(self.config.faiss_index_path))
        model = self._load_model()
        query_vec = model.encode([query], convert_to_numpy=True)
        query_vec = np.asarray(query_vec, dtype="float32")
        faiss.normalize_L2(query_vec)
        scores, indices = faiss_index.search(query_vec, limit)
        return [
            (int(idx), float(score))
            for idx, score in zip(indices[0], scores[0])
            if idx != -1
        ]

    def search(self, query: str, top_k: int = 5) -> Sequence[SearchResult]:
        keyword_hits = self._keyword_search(query, limit=top_k * 2)
        vector_hits = self._vector_search(query, limit=top_k * 2)

        combined: Dict[int, float] = {}

        def accumulate(hits: Sequence[Tuple[int, float]], weight: float) -> None:
            if not hits:
                return
            max_score = max(score for _, score in hits) or 1.0
            for doc_id, score in hits:
                combined[doc_id] = combined.get(doc_id, 0.0) + weight * (score / max_score)

        accumulate(keyword_hits, KEYWORD_WEIGHT)
        accumulate(vector_hits, VECTOR_WEIGHT)

        metadata = self._load_metadata()
        ranked = sorted(combined.items(), key=lambda item: item[1], reverse=True)[:top_k]

        results: List[SearchResult] = []
        for doc_id, score in ranked:
            info = metadata[doc_id]
            results.append(
                SearchResult(
                    doc_id=doc_id,
                    score=score,
                    content=info["content"],
                    metadata=info["metadata"],
                )
            )
        return results

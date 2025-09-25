"""LLM integration for answer generation."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Iterable

from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline

try:  # pragma: no cover - import shim for PyInstaller entrypoints
    from .config import AppConfig
except ImportError:  # pragma: no cover - fallback when package context is missing
    from kms_app.config import AppConfig

LOGGER = logging.getLogger(__name__)

try:  # Optional dependency
    import openai
except ImportError:  # pragma: no cover - optional dependency
    openai = None


class BaseLLM(ABC):
    @abstractmethod
    def generate_answer(self, question: str, context: Iterable[str]) -> str:  # pragma: no cover - interface
        raise NotImplementedError


class HuggingFaceLLM(BaseLLM):
    def __init__(self, model_name: str) -> None:
        LOGGER.info("Loading HuggingFace model %s", model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        self._pipeline = pipeline(
            "text2text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=256,
        )

    def generate_answer(self, question: str, context: Iterable[str]) -> str:
        prompt = build_prompt(question, context)
        output = self._pipeline(prompt, num_return_sequences=1)[0]["generated_text"]
        return output.strip()


class OpenAILLM(BaseLLM):
    def __init__(self, api_key: str) -> None:
        if openai is None:  # pragma: no cover - optional dependency
            raise RuntimeError(
                "openai package is not installed. Install openai to use this backend."
            )
        openai.api_key = api_key

    def generate_answer(self, question: str, context: Iterable[str]) -> str:
        prompt = build_prompt(question, context)
        response = openai.ChatCompletion.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful knowledge management assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        return response["choices"][0]["message"]["content"].strip()


def build_prompt(question: str, context: Iterable[str]) -> str:
    context_text = "\n---\n".join(context)
    return (
        "You are an enterprise knowledge base assistant. Use the provided context to "
        "answer the question. If the answer cannot be determined, say that you do not know.\n"
        f"Question: {question}\n"
        f"Context:\n{context_text}\n"
        "Answer:"
    )


class LLMClient:
    """Factory wrapper that selects the desired backend."""

    def __init__(self, config: AppConfig) -> None:
        backend = config.resolve_backend()
        if backend == "openai":
            self._client: BaseLLM = OpenAILLM(api_key=config.openai_api_key or "")
        else:
            self._client = HuggingFaceLLM(model_name=config.hf_model)

    def generate_answer(self, question: str, context: Iterable[str]) -> str:
        return self._client.generate_answer(question, context)

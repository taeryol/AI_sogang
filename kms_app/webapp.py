"""Flask web application exposing the MindBase knowledge services."""
from __future__ import annotations

import os

from flask import Flask, flash, redirect, render_template, request, url_for

from .config import AppConfig
from .knowledge_base import KnowledgeBaseService


def create_app(config: AppConfig | None = None) -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.secret_key = os.getenv("SECRET_KEY", "mindbase-dev-secret")
    app.config.setdefault("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)  # 16 MB

    kb_service = KnowledgeBaseService(config)

    def _render_home(**kwargs):
        stats = kb_service.stats_snapshot()
        documents = kb_service.list_documents()
        return render_template(
            "home.html",
            stats=stats,
            documents=documents,
            **kwargs,
        )

    @app.get("/")
    def home():  # pragma: no cover - interactive endpoint
        return _render_home(answer=None, question=None, contexts=None)

    @app.post("/upload")
    def upload_documents():  # pragma: no cover - interactive endpoint
        files = request.files.getlist("documents")
        try:
            saved_count, chunk_count = kb_service.save_and_index(files)
        except Exception as exc:
            flash(f"문서 업로드에 실패했습니다: {exc}", "danger")
            return redirect(url_for("home"))

        if saved_count == 0:
            flash("업로드할 문서를 선택하거나 지원되는 형식인지 확인하세요.", "warning")
        else:
            flash(
                f"{saved_count}개 문서를 업로드했고 {chunk_count}개의 조각을 인덱싱했습니다.",
                "success",
            )
        return redirect(url_for("home"))

    @app.post("/ask")
    def ask_question():  # pragma: no cover - interactive endpoint
        question = (request.form.get("question") or "").strip()
        if not question:
            flash("질문을 입력하세요.", "warning")
            return redirect(url_for("home"))

        try:
            answer, contexts = kb_service.answer_question(question)
        except FileNotFoundError:
            flash("먼저 문서를 업로드하고 인덱싱하세요.", "warning")
            return redirect(url_for("home"))
        except Exception as exc:
            flash(f"질문 처리 중 오류가 발생했습니다: {exc}", "danger")
            return redirect(url_for("home"))

        if not answer:
            flash("검색 결과가 충분하지 않습니다. 다른 질문을 시도해 보세요.", "info")
        return _render_home(answer=answer, contexts=contexts, question=question)

    @app.get("/admin")
    def admin_dashboard():  # pragma: no cover - interactive endpoint
        stats = kb_service.stats_snapshot()
        documents = kb_service.list_documents()
        return render_template("admin.html", stats=stats, documents=documents)

    return app


if __name__ == "__main__":  # pragma: no cover
    create_app().run(debug=True)

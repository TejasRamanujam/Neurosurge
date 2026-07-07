"""Note embeddings via the Gemini API (gemini-embedding-001).

Embeddings are requested at 1536 dimensions (outputDimensionality) so they
fit the existing pgvector column, then L2-normalized (truncated Gemini
embeddings are not unit-norm). When GEMINI_API_KEY is unset or the API
fails, generate_embedding returns None and callers fall back to the pure
TF-IDF path in similarity_service — the features keep working either way.
"""
import logging
import math
import re

import httpx

from app.config import settings
from app.database import SessionLocal
from app.models import Note

logger = logging.getLogger("neurosurge")

GEMINI_EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"
)


def generate_embedding(text: str):
    if not settings.gemini_api_key:
        return None
    try:
        resp = httpx.post(
            GEMINI_EMBED_URL.format(model=settings.embedding_model),
            headers={
                "x-goog-api-key": settings.gemini_api_key,
                "Content-Type": "application/json",
            },
            json={
                "content": {"parts": [{"text": text[:8000]}]},
                "outputDimensionality": settings.vector_dimension,
            },
            timeout=20.0,
        )
        resp.raise_for_status()
        values = resp.json()["embedding"]["values"]
        norm = math.sqrt(sum(v * v for v in values))
        if norm == 0:
            return None
        return [v / norm for v in values]
    except Exception:
        logger.warning("Gemini embedding request failed; falling back", exc_info=True)
        return None


def chunk_text(text: str, max_chars: int = 2000) -> list:
    chunks = []
    sections = re.split(r'(?=^#{1,3}\s)', text, flags=re.MULTILINE)
    for section in sections:
        section = section.strip()
        if not section:
            continue
        if len(section) <= max_chars:
            chunks.append(section)
        else:
            words = section.split()
            current = []
            length = 0
            for word in words:
                if length + len(word) + 1 > max_chars:
                    chunks.append(" ".join(current))
                    current = [word]
                    length = len(word)
                else:
                    current.append(word)
                    length += len(word) + 1
            if current:
                chunks.append(" ".join(current))
    return chunks


def update_note_embedding(note_id: int):
    db = SessionLocal()
    try:
        note = db.query(Note).filter(Note.id == note_id).first()
        if not note:
            return
        text = f"{note.title}\n\n{note.content}"
        embedding = generate_embedding(text)
        if embedding:
            note.embedding = embedding
            db.commit()
    finally:
        db.close()


def ensure_note_embeddings(db) -> bool:
    """Backfill embeddings for notes that don't have one yet.

    Returns True if the Gemini path is usable (key set and at least one
    embedding exists afterwards). Cheap at demo scale: one API call per
    missing note, only on first request after a note changes.
    """
    if not settings.gemini_api_key:
        return False
    missing = db.query(Note).filter(Note.embedding.is_(None)).all()
    for note in missing:
        embedding = generate_embedding(f"{note.title}\n\n{note.content}")
        if embedding:
            note.embedding = embedding
    if missing:
        db.commit()
    return db.query(Note).filter(Note.embedding.isnot(None)).count() > 0


def get_embedding_for_text(text: str):
    return generate_embedding(text)

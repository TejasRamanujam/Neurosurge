"""Related-note suggestions and semantic search.

Primary path: Gemini embeddings stored in pgvector, ranked by cosine
similarity. Fallback path (no GEMINI_API_KEY / API failure): pure-Python
TF-IDF cosine over the notes table. Both paths return the same shapes, so
the API works — with ranked results — in either configuration.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Note
from app.config import settings
from app.embedding_service import ensure_note_embeddings, get_embedding_for_text
from app.similarity_service import rank_by_similarity


def _pgvector_neighbors(db: Session, embedding, exclude_id: int, threshold: float, limit: int):
    emb_str = "[" + ",".join(str(x) for x in embedding) + "]"
    return db.execute(
        text("""
            SELECT id, title,
                   1 - (embedding <=> :emb) AS similarity
            FROM notes
            WHERE id != :exclude_id
              AND embedding IS NOT NULL
              AND 1 - (embedding <=> :emb) >= :threshold
            ORDER BY similarity DESC
            LIMIT :limit
        """),
        {"emb": emb_str, "exclude_id": exclude_id, "threshold": threshold, "limit": limit},
    ).fetchall()


def get_semantic_suggestions(db: Session, note_id: int, threshold: float = None, limit: int = 5) -> list:
    if threshold is None:
        threshold = settings.similarity_threshold

    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        return []

    # Gemini/pgvector path
    if ensure_note_embeddings(db):
        db.refresh(note)
        if note.embedding is not None:
            rows = _pgvector_neighbors(db, note.embedding, note_id, threshold, limit)
            if rows:
                return [
                    {
                        "note_id": row[0],
                        "title": row[1],
                        "similarity_score": round(float(row[2]), 4),
                        "reason": "Semantic similarity (Gemini embeddings)",
                    }
                    for row in rows
                ]

    # TF-IDF fallback (also used when the semantic path finds nothing)
    return suggest_by_tfidf(db, note, limit)


def suggest_by_tfidf(db: Session, note: Note, limit: int = 5) -> list:
    others = db.query(Note).filter(Note.id != note.id).all()
    if not others:
        return []
    documents = [(o.id, f"{o.title} {o.content}") for o in others]
    titles = {o.id: o.title for o in others}
    ranked = rank_by_similarity(documents, f"{note.title} {note.content}")
    return [
        {
            "note_id": doc_id,
            "title": titles[doc_id],
            "similarity_score": score,
            "reason": "Related by content (TF-IDF)",
        }
        for doc_id, score in ranked[:limit]
    ]


def semantic_search(db: Session, query: str, limit: int = 10) -> list:
    """Rank all notes against a free-text query. Returns
    [{id, title, content, score}] — Gemini embeddings when available,
    TF-IDF otherwise."""
    if settings.gemini_api_key and ensure_note_embeddings(db):
        query_embedding = get_embedding_for_text(query)
        if query_embedding:
            rows = db.execute(
                text("""
                    SELECT id, title, content,
                           1 - (embedding <=> :emb) AS similarity
                    FROM notes
                    WHERE embedding IS NOT NULL
                      AND 1 - (embedding <=> :emb) >= :threshold
                    ORDER BY similarity DESC
                    LIMIT :limit
                """),
                {
                    "emb": "[" + ",".join(str(x) for x in query_embedding) + "]",
                    "threshold": 0.45,
                    "limit": limit,
                },
            ).fetchall()
            return [
                {"id": r[0], "title": r[1], "content": r[2], "score": round(float(r[3]), 4)}
                for r in rows
            ]

    notes = db.query(Note).all()
    documents = [(n.id, f"{n.title} {n.content}") for n in notes]
    by_id = {n.id: n for n in notes}
    ranked = rank_by_similarity(documents, query)
    return [
        {"id": doc_id, "title": by_id[doc_id].title, "content": by_id[doc_id].content, "score": score}
        for doc_id, score in ranked[:limit]
    ]

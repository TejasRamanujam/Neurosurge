import math
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from app.models import Note
from app.config import settings
from app.embedding_service import get_embedding_for_text


def cosine_similarity(a: list, b: list) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def get_semantic_suggestions(db: Session, note_id: int, threshold: float = None, limit: int = 5) -> list:
    if threshold is None:
        threshold = settings.similarity_threshold

    note = db.query(Note).filter(Note.id == note_id).first()
    if not note or not note.embedding:
        return suggest_by_keywords(db, note_id, limit)

    embedding_array = note.embedding
    emb_str = "[" + ",".join(str(x) for x in embedding_array) + "]"

    results = db.execute(
        text(f"""
            SELECT id, title, content,
                   1 - (embedding <=> '{emb_str}') AS similarity
            FROM notes
            WHERE id != :note_id
              AND embedding IS NOT NULL
              AND 1 - (embedding <=> '{emb_str}') >= :threshold
            ORDER BY similarity DESC
            LIMIT :limit
        """),
        {"note_id": note_id, "threshold": threshold, "limit": limit}
    ).fetchall()

    suggestions = []
    for row in results:
        suggestions.append({
            "note_id": row[0],
            "title": row[1],
            "similarity_score": round(float(row[3]), 4),
            "reason": "Semantic similarity detected"
        })
    return suggestions


def suggest_by_keywords(db: Session, note_id: int, limit: int = 5) -> list:
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        return []

    title_words = set(note.title.lower().split())
    content_words = set(note.content.lower().split())
    stopwords = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
                 "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
                 "being", "have", "has", "had", "do", "does", "did", "will", "would",
                 "could", "should", "may", "might", "shall", "can", "need", "dare",
                 "ought", "used", "this", "that", "these", "those", "i", "you", "he",
                 "she", "it", "we", "they", "me", "him", "her", "us", "them", "my",
                 "your", "his", "its", "our", "their", "not", "no", "nor", "none",
                 "some", "any", "all", "both", "each", "few", "more", "most", "other",
                 "such", "what", "which", "who", "whom", "whose", "when", "where", "why", "how"}
    keywords = (title_words | content_words) - stopwords
    keywords = {w for w in keywords if len(w) > 2}

    all_notes = db.query(Note).filter(Note.id != note_id).all()
    scored = []
    for other in all_notes:
        other_text = (other.title + " " + other.content).lower()
        score = sum(1 for kw in keywords if kw in other_text)
        if score > 0:
            scored.append({
                "note_id": other.id,
                "title": other.title,
                "similarity_score": round(score / max(len(keywords), 1), 4),
                "reason": f"Shared keywords ({score} matches)"
            })

    scored.sort(key=lambda x: x["similarity_score"], reverse=True)
    return scored[:limit]


def generate_related_notes(db: Session, note_id: int, limit: int = 5) -> list:
    return get_semantic_suggestions(db, note_id, limit=limit)

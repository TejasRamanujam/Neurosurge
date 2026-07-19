import os
import logging
from contextlib import asynccontextmanager
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("neurosurge")

from fastapi import FastAPI, Depends, Query, HTTPException, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.database import get_db, engine, Base
from app.models import Note, Flashcard
from app.schemas import (
    NoteCreate, NoteUpdate, NoteResponse, NoteDetailResponse,
    KnowledgeGraphResponse, NoteGraphNode, NoteGraphEdge,
    Suggestion, FlashcardCreate, FlashcardGenerateRequest, FlashcardSuggestion,
    FlashcardReview, FlashcardResponse,
    SearchResult, Backlink,
)
from app import graph_service
from app.embedding_service import update_note_embedding
from app.spaced_repetition import review_flashcard, get_due_flashcards, get_flashcard_stats
from app.flashcard_generation import (
    FlashcardGenerationUnavailable,
    generate_flashcard_suggestions,
)
from app.suggestion_engine import get_semantic_suggestions, semantic_search
from app.parsing_service import extract_text_from_file, SUPPORTED_EXTENSIONS
from app.formatting_service import format_for_readability


@asynccontextmanager
async def lifespan(app: FastAPI):
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Neurosurge — Personal Knowledge Graph & Second Brain", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get(
            "ALLOWED_ORIGINS",
            "https://neurosurge.vercel.app,http://localhost:5173",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ─── Notes ───────────────────────────────────────────────────────────────────


@app.get("/api/notes", response_model=list[NoteResponse])
def list_notes(
    query: Optional[str] = Query(""),
    tag: Optional[str] = Query(""),
    limit: int = Query(50),
    db: Session = Depends(get_db),
):
    q = db.query(Note)
    if query:
        like = f"%{query}%"
        q = q.filter(
            or_(
                Note.title.ilike(like),
                Note.content.ilike(like),
            )
        )
    if tag:
        like = f"%{tag}%"
        q = q.filter(
            or_(
                Note.title.ilike(like),
                Note.content.ilike(like),
            )
        )
    return q.order_by(Note.updated_at.desc()).limit(limit).all()


@app.get("/api/notes/{note_id}", response_model=NoteDetailResponse)
def get_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    backlinks_raw = graph_service.get_backlinks(db, note_id)
    backlinks = [Backlink(note_id=b["note_id"], title=b["title"], type=b["type"]) for b in backlinks_raw]

    suggestions_raw = get_semantic_suggestions(db, note_id)
    suggestions = [Suggestion(**s) for s in suggestions_raw]

    flashcards = db.query(Flashcard).filter(Flashcard.note_id == note_id).all()

    return NoteDetailResponse(
        id=note.id,
        title=note.title,
        content=note.content,
        created_at=note.created_at,
        updated_at=note.updated_at,
        tags=graph_service.extract_tags(note.content),
        backlinks=backlinks,
        suggestions=suggestions,
        flashcards=[FlashcardResponse.model_validate(f) for f in flashcards],
    )


@app.post("/api/notes", response_model=NoteResponse, status_code=201)
def create_note(body: NoteCreate, db: Session = Depends(get_db)):
    note = Note(title=body.title, content=body.content)
    db.add(note)
    db.commit()
    db.refresh(note)

    if body.content.strip():
        update_note_embedding(note.id)
        db.refresh(note)

    return note


@app.put("/api/notes/{note_id}", response_model=NoteResponse)
def update_note(note_id: int, body: NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if body.title is not None:
        note.title = body.title
    if body.content is not None:
        note.content = body.content
    db.commit()
    db.refresh(note)

    if body.content is not None and body.content.strip():
        update_note_embedding(note.id)
        db.refresh(note)

    return note


@app.delete("/api/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"ok": True}


# ─── Knowledge Graph ─────────────────────────────────────────────────────────


@app.get("/api/graph", response_model=KnowledgeGraphResponse)
def get_knowledge_graph(db: Session = Depends(get_db)):
    data = graph_service.build_graph(db)
    nodes = [NoteGraphNode(**n) for n in data["nodes"]]
    edges = [NoteGraphEdge(**e) for e in data["edges"]]
    return KnowledgeGraphResponse(nodes=nodes, edges=edges)


@app.post("/api/graph/link")
def create_link(source_id: int = Query(...), target_id: int = Query(...), weight: float = Query(1.0)):
    # The graph is derived from note content ([[wikilinks]] and shared
    # hashtags), so explicit link storage is a no-op kept for API
    # compatibility.
    return {"ok": True}


@app.get("/api/tags")
def list_tags(db: Session = Depends(get_db)):
    return graph_service.get_all_tags(db)


@app.get("/api/backlinks/{note_id}")
def get_backlinks(note_id: int, db: Session = Depends(get_db)):
    return graph_service.get_backlinks(db, note_id)


# ─── Search ───────────────────────────────────────────────────────────────────


@app.get("/api/search", response_model=list[SearchResult])
def search(
    q: str = Query(...),
    db: Session = Depends(get_db),
):
    if not q.strip():
        return []

    like = f"%{q}%"
    notes = (
        db.query(Note)
        .filter(or_(Note.title.ilike(like), Note.content.ilike(like)))
        .limit(20)
        .all()
    )

    results = {}
    for note in notes:
        snippet = extract_snippet(note.content, q)
        results[note.id] = SearchResult(
            id=note.id,
            title=note.title,
            content_snippet=snippet,
            score=1.0 if q.lower() in note.title.lower() else 0.5,
            match_type="title" if q.lower() in note.title.lower() else "content",
        )

    # Semantic layer: Gemini embeddings when available, TF-IDF otherwise.
    for match in semantic_search(db, q, limit=10):
        if match["id"] not in results:
            results[match["id"]] = SearchResult(
                id=match["id"],
                title=match["title"],
                content_snippet=extract_snippet(match["content"], q),
                score=match["score"],
                match_type="semantic",
            )

    return sorted(results.values(), key=lambda r: r.score, reverse=True)


# ─── Flashcards ───────────────────────────────────────────────────────────────


@app.get("/api/flashcards/due", response_model=list[FlashcardResponse])
def due_flashcards(db: Session = Depends(get_db)):
    return get_due_flashcards(db)


@app.get("/api/flashcards/stats")
def flashcard_stats(db: Session = Depends(get_db)):
    return get_flashcard_stats(db)


@app.post("/api/flashcards", response_model=FlashcardResponse, status_code=201)
def create_flashcard(body: FlashcardCreate, db: Session = Depends(get_db)):
    card = Flashcard(note_id=body.note_id, question=body.question, answer=body.answer)
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@app.post("/api/flashcards/generate", response_model=list[FlashcardSuggestion])
def generate_flashcards(body: FlashcardGenerateRequest, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == body.note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    if not note.content.strip():
        raise HTTPException(status_code=422, detail="Add note content before drafting cards")
    try:
        return generate_flashcard_suggestions(note.title, note.content)
    except FlashcardGenerationUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/flashcards/{card_id}/review", response_model=FlashcardResponse)
def review(card_id: int, body: FlashcardReview, db: Session = Depends(get_db)):
    return review_flashcard(db, card_id, body.rating)


@app.get("/api/flashcards/note/{note_id}", response_model=list[FlashcardResponse])
def note_flashcards(note_id: int, db: Session = Depends(get_db)):
    return db.query(Flashcard).filter(Flashcard.note_id == note_id).all()


# ─── Helpers ──────────────────────────────────────────────────────────────────


def extract_snippet(content: str, query: str, context_chars: int = 120) -> str:
    idx = content.lower().find(query.lower())
    if idx == -1:
        return content[:context_chars] + ("..." if len(content) > context_chars else "")
    start = max(0, idx - context_chars // 2)
    end = min(len(content), idx + len(query) + context_chars // 2)
    snippet = content[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(content):
        snippet = snippet + "..."
    return snippet


# ─── Formatting ──────────────────────────────────────────────────────────────


@app.post("/api/format")
def format_text(content: str = Body(default="", embed=True)):
    formatted = format_for_readability(content)
    return {"formatted": formatted}


# ─── File Upload ────────────────────────────────────────────────────────────


SUPPORTED_UPLOAD_EXTENSIONS = list(SUPPORTED_EXTENSIONS.keys())
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@app.get("/api/uploads/extensions")
def upload_extensions():
    return SUPPORTED_UPLOAD_EXTENSIONS


@app.post("/api/uploads", response_model=NoteResponse, status_code=201)
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: {', '.join(SUPPORTED_UPLOAD_EXTENSIONS)}"
        )

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 10 MB demo limit")
    logger.info("Upload: %s (%d bytes, ext=%s)", filename, len(content), ext)

    if not content or len(content) == 0:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")

    extracted = extract_text_from_file(filename, content)

    if not extracted or not extracted.strip():
        logger.warning("Extraction returned empty for %s (%d bytes)", filename, len(content))
        raise HTTPException(status_code=422, detail="Could not extract text from file")

    title = os.path.splitext(file.filename or "Untitled")[0]
    formatted = format_for_readability(extracted)
    body = f"<blockquote>Uploaded from <code>{file.filename}</code></blockquote>\n\n{formatted}"

    note = Note(title=title, content=body)
    db.add(note)
    db.commit()
    db.refresh(note)

    update_note_embedding(note.id)
    db.refresh(note)

    return note


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)

import openai
from app.config import settings
from sqlalchemy.orm import Session
from app.models import Note
from app.database import SessionLocal
import re


openai.api_key = settings.openai_api_key


def generate_embedding(text: str) -> list:
    if not settings.openai_api_key:
        return None
    try:
        response = openai.embeddings.create(
            model=settings.embedding_model,
            input=text[:8000]
        )
        return response.data[0].embedding
    except Exception:
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


def get_embedding_for_text(text: str) -> list:
    return generate_embedding(text)

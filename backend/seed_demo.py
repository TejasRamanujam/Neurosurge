"""Minimal demo seed for Neurosurge (idempotent). Notes + flashcards in Postgres."""
from datetime import datetime, timezone, timedelta

from sqlalchemy import text
from app.database import SessionLocal, engine, Base
from app.models import Note, Flashcard

with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()
Base.metadata.create_all(bind=engine)

db = SessionLocal()
if db.query(Note).count() > 0:
    print("Already seeded; skipping.")
    raise SystemExit

now = datetime.now(timezone.utc)
notes = [
    Note(title="Welcome to Neurosurge",
         content="# Welcome\n\nThis is your **second brain**. Capture notes, link them with [[Spaced Repetition]] "
                 "and review with flashcards.\n\n#getting-started #meta"),
    Note(title="Spaced Repetition",
         content="The **SM-2** algorithm schedules reviews at growing intervals based on recall quality. "
                 "See also [[Active Recall]].\n\n#learning #memory"),
    Note(title="Active Recall",
         content="Retrieving information from memory strengthens it more than re-reading. Pairs well with "
                 "[[Spaced Repetition]].\n\n#learning #memory"),
    Note(title="Zettelkasten Method",
         content="Atomic notes connected by links form a knowledge graph. Each note holds one idea.\n\n#pkm #writing"),
    Note(title="Vector Embeddings",
         content="Text embeddings map notes into a vector space so semantically similar notes sit close together.\n\n#ml #search"),
]
db.add_all(notes)
db.flush()

cards = [
    (notes[1].id, "What does the SM-2 algorithm do?", "Schedules flashcard reviews at increasing intervals based on recall quality."),
    (notes[2].id, "Why is active recall effective?", "Retrieving from memory strengthens retention more than passive re-reading."),
    (notes[3].id, "What is an atomic note?", "A note that captures exactly one idea, linked to others."),
    (notes[4].id, "What are text embeddings used for?", "Mapping text into a vector space to find semantically similar content."),
]
for i, (nid, q, a) in enumerate(cards):
    db.add(Flashcard(note_id=nid, question=q, answer=a, ease=2.5, interval=1, repetitions=0,
                     next_review=now - timedelta(days=1 + i)))

db.commit()
print(f"Seeded {db.query(Note).count()} notes, {db.query(Flashcard).count()} flashcards.")
db.close()

"""Append more notes + flashcards (run once)."""
from datetime import datetime, timezone, timedelta

from sqlalchemy import text
from app.database import SessionLocal, engine, Base
from app.models import Note, Flashcard

with engine.connect() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.commit()
Base.metadata.create_all(bind=engine)
db = SessionLocal()
now = datetime.now(timezone.utc)

notes = [
    Note(title="Feynman Technique", content="Explain a concept in plain language as if teaching a child; gaps reveal what you don't understand. See [[Active Recall]].\n\n#learning #teaching"),
    Note(title="Interleaving", content="Mixing problem types during practice improves discrimination and transfer, unlike blocked practice.\n\n#learning #practice"),
    Note(title="Knowledge Graphs", content="Nodes are entities, edges are relationships. Great for traversal queries. Related: [[Zettelkasten Method]].\n\n#pkm #graphs"),
    Note(title="Cosine Similarity", content="Measures the angle between two vectors; used to compare [[Vector Embeddings]].\n\n#ml #math"),
    Note(title="RAG Pattern", content="Retrieval-Augmented Generation grounds an LLM in retrieved documents to reduce hallucination.\n\n#ml #ai"),
    Note(title="Markdown Basics", content="`#` headings, `**bold**`, `[[wikilinks]]`, and `- lists`. The backbone of plain-text notes.\n\n#writing #meta"),
    Note(title="Daily Notes", content="A dated note per day captures fleeting thoughts; link them to evergreen notes later.\n\n#pkm #habits"),
    Note(title="Evergreen Notes", content="Notes written to be developed and reused over time, stated as full claims.\n\n#pkm #writing"),
    Note(title="Forgetting Curve", content="Memory decays exponentially without review; spacing flattens the curve. See [[Spaced Repetition]].\n\n#memory #learning"),
    Note(title="Embeddings vs Keywords", content="Keyword search matches tokens; [[Vector Embeddings]] match meaning.\n\n#search #ml"),
]
db.add_all(notes)
db.flush()

cards = [
    (notes[0].id, "What is the Feynman Technique?", "Explaining a concept in simple terms to expose gaps in understanding."),
    (notes[1].id, "Why is interleaving effective?", "Mixing problem types improves discrimination and transfer vs blocked practice."),
    (notes[3].id, "What does cosine similarity measure?", "The angle between two vectors — how similar their directions are."),
    (notes[4].id, "What problem does RAG address?", "It grounds LLM answers in retrieved documents to reduce hallucination."),
    (notes[8].id, "What is the forgetting curve?", "The exponential decay of memory over time without review."),
    (notes[9].id, "Keyword vs embedding search?", "Keywords match tokens; embeddings match meaning."),
]
for i, (nid, q, a) in enumerate(cards):
    db.add(Flashcard(note_id=nid, question=q, answer=a, ease=2.5, interval=1, repetitions=0, next_review=now - timedelta(hours=i + 1)))

db.commit()
print(f"Totals: {db.query(Note).count()} notes, {db.query(Flashcard).count()} flashcards.")
db.close()

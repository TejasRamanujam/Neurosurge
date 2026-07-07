"""Vercel serverless entrypoint — imports the FastAPI app from backend/.

Everything runs against Neon Postgres (with pgvector): notes, tags,
backlinks, spaced-repetition flashcards, and the knowledge graph (derived
from [[wikilinks]] and shared #hashtags — no graph database). Semantic
search / suggestions use Gemini embeddings when GEMINI_API_KEY is set and
fall back to pure-Python TF-IDF similarity when it isn't.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app  # noqa: E402,F401

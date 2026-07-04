"""Vercel serverless entrypoint — imports the FastAPI app from backend/.

Notes, tags, backlinks and spaced-repetition flashcards run against Neon
Postgres (with pgvector). The Neo4j graph view, OpenAI semantic search /
embeddings, and file-upload parsing are the degraded parts (they need those
external services / keys); their imports are lazy so the app boots fine.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app  # noqa: E402,F401

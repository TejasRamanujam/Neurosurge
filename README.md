# Neurosurge — Second Brain

![CI](https://github.com/TejasRamanujam/Neurosurge-Second-Brain/actions/workflows/ci.yml/badge.svg)

**Live: https://neurosurge.vercel.app**

Notes as a territory: wikilinks and hashtags feed a force-directed knowledge graph, spaced-repetition flashcards, and semantic search.

## Features
- `[[wikilink]]` notes rendered as an interactive force-directed graph
- Spaced-repetition flashcards (rehearsal mode)
- Gemini-embedding semantic search over your notes (pgvector)
- PDF/DOCX import
- Responsive down to phone widths

## Stack
React + TypeScript (Vite) · FastAPI on Vercel functions · Neon Postgres + pgvector · Gemini embeddings

## Run locally
```bash
cd frontend && npm install && npm run dev
cd backend && pip install -r ../requirements.txt && uvicorn main:app --reload
```

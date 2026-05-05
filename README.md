# Neurosurge — Personal Knowledge Graph & Second Brain

A powerful knowledge management system that combines graph-based note organization, AI-powered connection suggestions, semantic search, and spaced repetition flashcards.

## Architecture

- **Backend**: FastAPI + PostgreSQL (pgvector) + Neo4j + Redis + Celery
- **Frontend**: React 19 + TypeScript + Vite + TipTap + react-force-graph-2d
- **AI**: OpenAI embeddings (text-embedding-3-small) for semantic similarity
- **Graph**: Neo4j for knowledge graph relationships and backlink tracking

## Key Features

- **Graph-based note organization** with Neo4j knowledge graph
- **AI-powered connection suggestions** via embedding similarity
- **Semantic search** across all notes
- **Auto-generated spaced repetition flashcards** (SM-2 algorithm)
- **Rich markdown editor** with TipTap (headings, lists, tables, code blocks, etc.)
- **Interactive knowledge graph visualization** with force-directed layout
- **Backlink and reference tracking** for connected thinking

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (for Neo4j, PostgreSQL, Redis)

### Quick Start with Docker

```bash
docker-compose up -d
```

### Manual Setup

#### 1. Start Dependencies

```bash
docker run -d --name neurosurge-postgres -e POSTGRES_DB=neurosurge -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16
docker run -d --name neurosurge-neo4j -e NEO4J_AUTH=neo4j/password -p 7687:7687 -p 7474:7474 neo4j:5-community
docker run -d --name neurosurge-redis -p 6379:6379 redis:7-alpine
```

#### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --port 8001 --reload
```

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/notes | List all notes |
| POST | /api/notes | Create a note |
| GET | /api/notes/:id | Get note with context |
| PUT | /api/notes/:id | Update a note |
| DELETE | /api/notes/:id | Delete a note |
| GET | /api/graph | Get knowledge graph data |
| POST | /api/graph/link | Create a relationship link |
| GET | /api/search?q= | Search notes |
| GET | /api/tags | List all tags |
| GET | /api/backlinks/:id | Get note backlinks |
| GET | /api/flashcards/due | Get due flashcards |
| POST | /api/flashcards | Create a flashcard |
| POST | /api/flashcards/:id/review | Review a flashcard |
| GET | /api/flashcards/stats | Get flashcard statistics |

## Project Structure

```
neurosurge/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── database.py           # SQLAlchemy setup
│   │   ├── models.py             # Note & Flashcard models
│   │   ├── schemas.py            # Pydantic schemas
│   │   ├── neo4j_client.py       # Neo4j graph client
│   │   ├── embedding_service.py  # OpenAI embedding pipeline
│   │   ├── suggestion_engine.py  # Semantic suggestion engine
│   │   ├── spaced_repetition.py   # SM-2 algorithm
│   │   └── config.py             # Configuration
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main application
│   │   ├── components/
│   │   │   ├── Editor/           # TipTap rich editor
│   │   │   ├── Graph/            # Knowledge graph visualization
│   │   │   ├── Flashcards/       # Spaced repetition review
│   │   │   ├── Notes/            # Note list and detail
│   │   │   ├── Sidebar/          # Backlinks & suggestions
│   │   │   └── Search/           # Search bar
│   │   ├── api.ts                # API client
│   │   └── types.ts              # TypeScript types
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

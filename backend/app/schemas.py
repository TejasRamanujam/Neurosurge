from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class NoteCreate(BaseModel):
    title: str
    content: str = ""


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class NoteResponse(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoteGraphNode(BaseModel):
    id: int
    title: str
    tags: List[str] = []
    connection_count: int = 0


class NoteGraphEdge(BaseModel):
    source: int
    target: int
    weight: float = 1.0
    relationship_type: str = "RELATES_TO"


class KnowledgeGraphResponse(BaseModel):
    nodes: List[NoteGraphNode]
    edges: List[NoteGraphEdge]


class Suggestion(BaseModel):
    note_id: int
    title: str
    similarity_score: float
    reason: str


class FlashcardCreate(BaseModel):
    note_id: int
    question: str
    answer: str


class FlashcardGenerateRequest(BaseModel):
    note_id: int


class FlashcardSuggestion(BaseModel):
    question: str
    answer: str


class FlashcardReview(BaseModel):
    rating: int


class FlashcardResponse(BaseModel):
    id: int
    note_id: int
    question: str
    answer: str
    ease: float
    interval: int
    repetitions: int
    next_review: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchResult(BaseModel):
    id: int
    title: str
    content_snippet: str
    score: float
    match_type: str


class Backlink(BaseModel):
    note_id: int
    title: str
    type: str


class NoteDetailResponse(NoteResponse):
    tags: List[str] = []
    backlinks: List[Backlink] = []
    suggestions: List[Suggestion] = []
    flashcards: List[FlashcardResponse] = []

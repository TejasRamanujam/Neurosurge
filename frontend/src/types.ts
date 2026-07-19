export interface Note {
  id: number
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface NoteDetail extends Note {
  tags: string[]
  backlinks: Backlink[]
  suggestions: Suggestion[]
  flashcards: Flashcard[]
}

export interface GraphNode {
  id: number
  title: string
  tags: string[]
  connection_count: number
}

export interface GraphEdge {
  source: number
  target: number
  weight: number
  relationship_type: string
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface Suggestion {
  note_id: number
  title: string
  similarity_score: number
  reason: string
}

export interface Flashcard {
  id: number
  note_id: number
  question: string
  answer: string
  ease: number
  interval: number
  repetitions: number
  next_review: string | null
  created_at: string
}

export interface FlashcardSuggestion {
  question: string
  answer: string
}

export interface SearchResult {
  id: number
  title: string
  content_snippet: string
  score: number
  match_type: string
}

export interface Backlink {
  note_id: number
  title: string
  type: string
}

export interface FlashcardStats {
  total: number
  due: number
  reviewed_today: number
}

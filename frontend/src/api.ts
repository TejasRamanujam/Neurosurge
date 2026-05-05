import type { Note, NoteDetail, KnowledgeGraph, SearchResult, Flashcard, FlashcardStats } from './types'

const API = '/api'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(detail.detail || `API Error: ${res.status}`)
  }
  return res.json()
}

export async function fetchNotes(query?: string, tag?: string): Promise<Note[]> {
  const params = new URLSearchParams()
  if (query) params.set('query', query)
  if (tag) params.set('tag', tag)
  const qs = params.toString()
  return request<Note[]>(`${API}/notes${qs ? `?${qs}` : ''}`)
}

export async function fetchNote(id: number): Promise<NoteDetail> {
  return request<NoteDetail>(`${API}/notes/${id}`)
}

export async function createNote(title: string, content: string): Promise<Note> {
  return request<Note>(`${API}/notes`, {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  })
}

export async function updateNote(id: number, title: string, content: string): Promise<Note> {
  return request<Note>(`${API}/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, content }),
  })
}

export async function deleteNote(id: number): Promise<void> {
  await fetch(`${API}/notes/${id}`, { method: 'DELETE' })
}

export async function fetchGraph(): Promise<KnowledgeGraph> {
  return request<KnowledgeGraph>(`${API}/graph`)
}

export async function createLink(sourceId: number, targetId: number, weight?: number): Promise<void> {
  await fetch(`${API}/graph/link?source_id=${sourceId}&target_id=${targetId}&weight=${weight ?? 1.0}`, {
    method: 'POST',
  })
}

export async function fetchTags(): Promise<string[]> {
  return request<string[]>(`${API}/tags`)
}

export async function searchNotes(q: string): Promise<SearchResult[]> {
  return request<SearchResult[]>(`${API}/search?q=${encodeURIComponent(q)}`)
}

export async function fetchDueFlashcards(): Promise<Flashcard[]> {
  return request<Flashcard[]>(`${API}/flashcards/due`)
}

export async function fetchFlashcardStats(): Promise<FlashcardStats> {
  return request<FlashcardStats>(`${API}/flashcards/stats`)
}

export async function createFlashcard(noteId: number, question: string, answer: string): Promise<Flashcard> {
  return request<Flashcard>(`${API}/flashcards`, {
    method: 'POST',
    body: JSON.stringify({ note_id: noteId, question, answer }),
  })
}

export async function reviewFlashcard(cardId: number, rating: number): Promise<Flashcard> {
  return request<Flashcard>(`${API}/flashcards/${cardId}/review`, {
    method: 'POST',
    body: JSON.stringify({ rating }),
  })
}

export async function fetchNoteFlashcards(noteId: number): Promise<Flashcard[]> {
  return request<Flashcard[]>(`${API}/flashcards/note/${noteId}`)
}

export async function formatContent(content: string): Promise<string> {
  const res = await request<{ formatted: string }>(`${API}/format`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
  return res.formatted
}

export async function uploadFile(file: File): Promise<Note> {
  const form = new FormData()
  form.append('file', file)
  return request<Note>(`${API}/uploads`, { method: 'POST', body: form })
}

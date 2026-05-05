import { useState, useEffect } from 'react'
import { fetchNotes } from '../../api'
import type { Note } from '../../types'
import NoteCard from './NoteCard'

interface NoteListProps {
  onSelectNote: (id: number) => void
  refreshTrigger: number
}

export default function NoteList({ onSelectNote, refreshTrigger }: NoteListProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotes()
  }, [refreshTrigger])

  async function loadNotes() {
    setLoading(true)
    try {
      const data = await fetchNotes()
      setNotes(data)
    } catch (err) {
      console.error('Failed to load notes:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner" />Loading notes...</div>
  }

  if (notes.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">📝</div>
        <h3>No notes yet</h3>
        <p>Create your first note to start building your knowledge graph.</p>
      </div>
    )
  }

  return (
    <div className="notes-grid">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onClick={() => onSelectNote(note.id)} />
      ))}
    </div>
  )
}

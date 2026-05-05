import { useState, useEffect } from 'react'
import { fetchNote, updateNote, deleteNote } from '../../api'
import type { NoteDetail, Flashcard } from '../../types'
import TipTapEditor from '../Editor/TipTapEditor'
import BacklinkPanel from '../Sidebar/BacklinkPanel'
import SuggestionsPanel from '../Sidebar/SuggestionsPanel'
import NoteFlashcards from '../Sidebar/NoteFlashcards'

interface NoteDetailViewProps {
  noteId: number
  onBack: () => void
  onNavigate: (noteId: number) => void
  onDeleted: () => void
}

export default function NoteDetailView({ noteId, onBack, onNavigate, onDeleted }: NoteDetailViewProps) {
  const [detail, setDetail] = useState<NoteDetail | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contextTab, setContextTab] = useState<'backlinks' | 'suggestions' | 'flashcards'>('backlinks')
  const [dirty, setDirty] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadNote()
  }, [noteId])

  async function loadNote() {
    setLoading(true)
    try {
      const data = await fetchNote(noteId)
      setDetail(data)
      setTitle(data.title)
      setContent(data.content)
      setDirty(false)
    } catch (err) {
      console.error('Failed to load note:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!dirty) return
    setSaving(true)
    try {
      const updated = await updateNote(noteId, title, content)
      if (detail) {
        setDetail({ ...detail, ...updated })
      }
      setDirty(false)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this note?')) return
    setDeleting(true)
    try {
      await deleteNote(noteId)
      onDeleted()
    } catch (err) {
      console.error('Failed to delete:', err)
      setDeleting(false)
    }
  }

  function handleFlashcardCreated(card: Flashcard) {
    if (detail) {
      setDetail({ ...detail, flashcards: [...detail.flashcards, card] })
    }
  }

  if (loading) {
    return <div className="loading"><div className="spinner" />Loading note...</div>
  }

  if (!detail) {
    return (
      <div className="empty-state">
        <h3>Note not found</h3>
        <button className="btn btn-primary" onClick={onBack}>Back</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div className="note-detail">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-secondary" onClick={onBack}>← Back</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
            {detail.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                {detail.tags.map((t: string) => (
                  <span key={t} className="tag-badge">#{t}</span>
                ))}
              </div>
            )}
          </div>

          <input
            className="note-title-input"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
            placeholder="Note title..."
          />

          <TipTapEditor
            content={content}
            onChange={(html: string) => { setContent(html); setDirty(true) }}
            placeholder="Start writing your thoughts..."
          />
        </div>
      </div>

      <div className="context-panel">
        <div className="context-panel-header">
          Context Panel
        </div>
        <div className="context-panel-tabs">
          <button
            className={`context-tab${contextTab === 'backlinks' ? ' active' : ''}`}
            onClick={() => setContextTab('backlinks')}
          >
            Backlinks ({detail.backlinks.length})
          </button>
          <button
            className={`context-tab${contextTab === 'suggestions' ? ' active' : ''}`}
            onClick={() => setContextTab('suggestions')}
          >
            Suggestions ({detail.suggestions.length})
          </button>
          <button
            className={`context-tab${contextTab === 'flashcards' ? ' active' : ''}`}
            onClick={() => setContextTab('flashcards')}
          >
            Flashcards ({detail.flashcards.length})
          </button>
        </div>
        <div className="context-panel-body">
          {contextTab === 'backlinks' && (
            <BacklinkPanel backlinks={detail.backlinks} onNavigate={onNavigate} />
          )}
          {contextTab === 'suggestions' && (
            <SuggestionsPanel suggestions={detail.suggestions} onNavigate={onNavigate} />
          )}
          {contextTab === 'flashcards' && (
            <NoteFlashcards
              noteId={noteId}
              flashcards={detail.flashcards}
              onFlashcardCreated={handleFlashcardCreated}
            />
          )}
        </div>
      </div>
    </div>
  )
}

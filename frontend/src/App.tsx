import { useState, useCallback, useEffect, useRef } from 'react'
import './App.css'
import TipTapEditor from './components/Editor/TipTapEditor'
import KnowledgeGraphView from './components/Graph/KnowledgeGraph'
import FlashcardReview from './components/Flashcards/FlashcardReview'
import FlashcardCreateForm from './components/Flashcards/FlashcardCreateForm'
import BacklinkPanel from './components/Sidebar/BacklinkPanel'
import SuggestionsPanel from './components/Sidebar/SuggestionsPanel'
import { fetchNotes, fetchNote, createNote, updateNote, deleteNote, uploadFile, formatContent } from './api'
import type { Note, NoteDetail, Flashcard } from './types'

type Tab = 'notes' | 'graph' | 'flashcards'
type RightTab = 'backlinks' | 'suggestions' | 'flashcards'

function stripHtml(html: string): string {
  const d = document.createElement('div')
  d.innerHTML = html
  return d.textContent || d.innerText || ''
}

function NoteIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
}

function NeuralLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <line x1="50" y1="50" x2="78" y2="24" stroke="#7c5cff" strokeWidth="2.5" opacity="0.5" />
      <line x1="50" y1="50" x2="22" y2="30" stroke="#4cc9f0" strokeWidth="2.5" opacity="0.5" />
      <line x1="50" y1="50" x2="30" y2="78" stroke="#7c5cff" strokeWidth="2.5" opacity="0.5" />
      <line x1="50" y1="50" x2="76" y2="72" stroke="#4cc9f0" strokeWidth="2.5" opacity="0.5" />
      <line x1="78" y1="24" x2="76" y2="72" stroke="#7c5cff" strokeWidth="1.5" opacity="0.25" />
      <line x1="22" y1="30" x2="30" y2="78" stroke="#4cc9f0" strokeWidth="1.5" opacity="0.25" />
      <circle cx="50" cy="50" r="13" fill="#7c5cff" />
      <circle cx="50" cy="50" r="19" stroke="#7c5cff" strokeWidth="1.5" opacity="0.35" />
      <circle className="pulse" cx="78" cy="24" r="7" fill="#4cc9f0" />
      <circle className="pulse" cx="22" cy="30" r="5.5" fill="#7c5cff" style={{ animationDelay: '0.6s' }} />
      <circle className="pulse" cx="30" cy="78" r="6.5" fill="#4cc9f0" style={{ animationDelay: '1.2s' }} />
      <circle className="pulse" cx="76" cy="72" r="5" fill="#7c5cff" style={{ animationDelay: '1.8s' }} />
    </svg>
  )
}

function FileUploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList) => {
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file)
      }
      onUploaded()
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={`upload-zone${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" multiple hidden onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files) }} />
      <p>{uploading ? 'Uploading...' : 'Drop PDF, DOC, DOCX'}</p>
      <div className="ext-list">or click to browse</div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('notes')
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<NoteDetail | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [rightTab, setRightTab] = useState<RightTab>('backlinks')
  const [showUpload, setShowUpload] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [notesLoading, setNotesLoading] = useState(true)

  useEffect(() => { loadNotes() }, [searchQuery])

  async function loadNotes() {
    try {
      const data = await fetchNotes(searchQuery)
      setNotes(data)
    } catch (err) { console.error(err) }
    setNotesLoading(false)
  }

  async function loadDetail(id: number) {
    try {
      const data = await fetchNote(id)
      setDetail(data)
      setTitle(data.title)
      setContent(data.content)
      setDirty(false)
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId])

  function handleSelectNote(id: number) {
    setSelectedId(id)
    setTab('notes')
  }

  async function handleCreateNote() {
    try {
      const note = await createNote('Untitled', '')
      setNotes((prev) => [note, ...prev])
      setSelectedId(note.id)
    } catch (err) { console.error(err) }
  }

  async function handleSave() {
    if (!selectedId || !dirty) return
    setSaving(true)
    try {
      await updateNote(selectedId, title, content)
      setDirty(false)
      loadNotes()
      if (detail) setDetail({ ...detail, title, content } as NoteDetail)
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  async function handleFormat() {
    if (!selectedId || formatting) return
    setFormatting(true)
    try {
      const formatted = await formatContent(content)
      setContent(formatted)
      setDirty(true)
    } catch (err) { console.error(err) }
    setFormatting(false)
  }

  async function handleDelete() {
    if (!selectedId || !confirm('Delete this note permanently?')) return
    try {
      await deleteNote(selectedId)
      setSelectedId(null)
      setDetail(null)
      loadNotes()
    } catch (err) { console.error(err) }
  }

  function handleUploaded() {
    setShowUpload(false)
    loadNotes()
  }

  function handleFlashcardCreated(card: Flashcard) {
    if (detail) setDetail({ ...detail, flashcards: [...detail.flashcards, card] })
  }

  const filteredNotes = searchQuery
    ? notes.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : notes

  return (
    <div className="app-shell">
      {/* Title Bar */}
      <div className="titlebar">
        <div className="titlebar-logo">
          <NeuralLogo />
          <span>Neurosurge</span>
        </div>
        <nav className="titlebar-tabs" aria-label="Main views">
          <button className={`titlebar-tab${tab === 'notes' ? ' active' : ''}`} onClick={() => setTab('notes')}>Notes</button>
          <button className={`titlebar-tab${tab === 'graph' ? ' active' : ''}`} onClick={() => setTab('graph')}>Graph</button>
          <button className={`titlebar-tab${tab === 'flashcards' ? ' active' : ''}`} onClick={() => setTab('flashcards')}>Flashcards</button>
        </nav>
        <a className="back-pill" href="https://tejas-live-demos.vercel.app">
          &larr;<span className="back-label"> Back to demos</span>
        </a>
      </div>

      {/* Body */}
      <div className="app-body">
        {/* Left Sidebar */}
        <div className="left-sidebar">
          <div className="sidebar-search">
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="sidebar-section-header">
            <span>Files</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{notes.length}</span>
          </div>

          <div className="file-list">
            {notesLoading && (
              <div className="skeleton-list" aria-hidden="true">
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line w80" />
                <div className="skeleton skeleton-line" />
                <div className="skeleton skeleton-line w60" />
              </div>
            )}
            {!notesLoading && filteredNotes.map((note) => (
              <button
                key={note.id}
                className={`file-item${selectedId === note.id ? ' active' : ''}`}
                onClick={() => handleSelectNote(note.id)}
              >
                <span className="icon"><NoteIcon /></span>
                {note.title || 'Untitled'}
              </button>
            ))}
            {!notesLoading && filteredNotes.length === 0 && (
              <div className="panel-empty">
                <p>{searchQuery ? 'No notes match your search.' : 'No notes yet — create your first one below.'}</p>
              </div>
            )}
          </div>

          <div className="sidebar-actions">
            <button className="sidebar-btn primary" onClick={handleCreateNote}>
              + New Note
            </button>
            <button className="sidebar-btn" onClick={() => setShowUpload(!showUpload)}>
              Upload PDF/DOC
            </button>
            {showUpload && <FileUploadZone onUploaded={handleUploaded} />}
          </div>
        </div>

        {/* Main Area */}
        <div className="main-area">
          <div className="main-content">
            {/* Notes / Editor */}
            {tab === 'notes' && !selectedId && (
              <div className="welcome-view">
                <NeuralLogo className="neural-mark" />
                <h1>Welcome to Neurosurge</h1>
                <p>Your second brain. Capture notes, connect ideas, and let the graph grow as you think.</p>
                <button className="sidebar-btn primary" onClick={handleCreateNote}>+ Create your first note</button>
              </div>
            )}

            {tab === 'notes' && selectedId && detail && (
              <div className="editor-view">
                <div className="editor-actions">
                  <button
                    className={`editor-btn save${!dirty ? ' saved' : ''}`}
                    onClick={handleSave}
                    disabled={!dirty || saving}
                  >
                    {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
                  </button>
                  <button className="editor-btn secondary" onClick={handleFormat} disabled={formatting}>
                    {formatting ? 'Formatting...' : '✦ Format'}
                  </button>
                  <button className="editor-btn secondary" onClick={() => { setSelectedId(null); loadNotes() }}>
                    Close
                  </button>
                  <button className="editor-btn danger" onClick={handleDelete}>Delete</button>
                  {detail.tags.length > 0 && (
                    <span className="note-tags">
                      {detail.tags.map((t) => (
                        <span key={t} className="tag-chip">#{t}</span>
                      ))}
                    </span>
                  )}
                </div>

                <input
                  className="editor-title-input"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
                  placeholder="Untitled"
                />

                <TipTapEditor
                  content={content}
                  onChange={(html: string) => { setContent(html); setDirty(true) }}
                  placeholder="Start writing..."
                />
              </div>
            )}

            {/* Graph */}
            {tab === 'graph' && (
              <KnowledgeGraphView
                onSelectNote={handleSelectNote}
                highlightNoteId={selectedId}
              />
            )}

            {/* Flashcards */}
            {tab === 'flashcards' && (
              <div className="flashcard-view">
                <FlashcardReview />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel (context for selected note) */}
        {tab === 'notes' && detail && (
          <div className="right-panel">
            <div className="right-panel-header">Note Context</div>
            <div className="right-panel-tabs">
              <button className={`right-tab${rightTab === 'backlinks' ? ' active' : ''}`} onClick={() => setRightTab('backlinks')}>
                Backlinks ({detail.backlinks.length})
              </button>
              <button className={`right-tab${rightTab === 'suggestions' ? ' active' : ''}`} onClick={() => setRightTab('suggestions')}>
                Related ({detail.suggestions.length})
              </button>
              <button className={`right-tab${rightTab === 'flashcards' ? ' active' : ''}`} onClick={() => setRightTab('flashcards')}>
                Cards ({detail.flashcards.length})
              </button>
            </div>
            <div className="right-panel-body">
              {rightTab === 'backlinks' && (
                <BacklinkPanel backlinks={detail.backlinks} onNavigate={handleSelectNote} />
              )}
              {rightTab === 'suggestions' && (
                <SuggestionsPanel suggestions={detail.suggestions} onNavigate={handleSelectNote} />
              )}
              {rightTab === 'flashcards' && (
                <div>
                  {detail.flashcards.map((fc) => (
                    <div key={fc.id} className="context-item" style={{ cursor: 'default' }}>
                      <h4>{fc.question}</h4>
                      <p>{fc.answer}</p>
                    </div>
                  ))}
                  <div style={{ marginTop: 12 }}>
                    <FlashcardCreateForm noteId={detail.id} onCreated={handleFlashcardCreated} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

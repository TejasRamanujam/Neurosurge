import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from './components/Editor'
import AtlasGraph from './components/AtlasGraph'
import Rehearsal from './components/Rehearsal'
import Marginalia from './components/Marginalia'
import Palette from './components/Palette'
import {
  fetchNotes, fetchNote, createNote, updateNote, deleteNote,
  uploadFile, fetchFlashcardStats,
} from './api'
import type { Note, NoteDetail, Flashcard } from './types'

type Tab = 'index' | 'atlas' | 'rehearsal'

function CompassMark() {
  return (
    <svg className="masthead-mark" width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
      <path d="M16 1.5v5M16 25.5v5M1.5 16h5M25.5 16h5" stroke="var(--ink)" strokeWidth="1.4" />
      <path className="needle" d="M16 7.5 L19 16 L16 24.5 L13 16 Z" fill="var(--vermilion)" />
      <circle cx="16" cy="16" r="1.8" fill="var(--ink)" />
    </svg>
  )
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function UploadZone({ onUploaded }: { onUploaded: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList) {
    setUploading(true)
    try {
      for (const file of Array.from(files)) await uploadFile(file)
      onUploaded()
    } catch (err) {
      console.error('Upload failed:', err)
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className={`dropzone${dragging ? ' dragging' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Accession a PDF or Word document as a new note"
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
    >
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx" multiple hidden onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files) }} />
      {uploading ? 'Accessioning…' : 'Accession PDF / DOCX — drop or click'}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('index')
  const [notes, setNotes] = useState<Note[]>([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<NoteDetail | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [dueCount, setDueCount] = useState(0)
  const [listCollapsed, setListCollapsed] = useState(false)

  const loadNotes = useCallback(async () => {
    try {
      const data = await fetchNotes()
      setNotes(data)
    } catch (err) { console.error(err) }
    setNotesLoading(false)
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const s = await fetchFlashcardStats()
      setDueCount(s.due)
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => { loadNotes(); loadStats() }, [loadNotes, loadStats])

  const loadDetail = useCallback(async (id: number) => {
    try {
      const data = await fetchNote(id)
      setDetail(data)
      setTitle(data.title)
      setContent(data.content)
      setDirty(false)
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  function openNote(id: number) {
    setSelectedId(id)
    setTab('index')
    setPaletteOpen(false)
    setListCollapsed(true)
  }

  async function handleCreate() {
    try {
      const note = await createNote('Untitled', '')
      setNotes((prev) => [note, ...prev])
      openNote(note.id)
    } catch (err) { console.error(err) }
  }

  const handleSave = useCallback(async () => {
    if (!selectedId || !dirty || saving) return
    setSaving(true)
    try {
      await updateNote(selectedId, title, content)
      setDirty(false)
      loadNotes()
      setDetail((d) => (d ? { ...d, title, content } : d))
    } catch (err) { console.error(err) }
    setSaving(false)
  }, [selectedId, dirty, saving, title, content, loadNotes])

  async function handleDelete() {
    if (!selectedId || !window.confirm('Strike this entry from the record permanently?')) return
    try {
      await deleteNote(selectedId)
      setSelectedId(null)
      setDetail(null)
      loadNotes()
    } catch (err) { console.error(err) }
  }

  function handleWikilink(linkTitle: string) {
    const t = linkTitle.trim().toLowerCase()
    const target = notes.find((n) => (n.title || '').trim().toLowerCase() === t)
    if (target) openNote(target.id)
  }

  // global shortcuts: ⌘K palette, ⌘S save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleSave])

  const filtered = filter
    ? notes.filter((n) => (n.title || '').toLowerCase().includes(filter.toLowerCase()))
    : notes

  return (
    <div className="plate">
      <header className="masthead">
        <div className="masthead-brand">
          <CompassMark />
          <div>
            <div className="masthead-title">Neurosurge</div>
            <div className="masthead-sub">Terra Cognita · an atlas of a mind</div>
          </div>
          <a className="back-demos" href="https://tejas-live-demos.vercel.app">← Back to demos</a>
        </div>
        <nav className="masthead-nav" aria-label="Views">
          <button className="nav-tab" aria-current={tab === 'index'} onClick={() => setTab('index')}>
            <span className="roman">I</span> The Index
          </button>
          <button className="nav-tab" aria-current={tab === 'atlas'} onClick={() => setTab('atlas')}>
            <span className="roman">II</span> The Atlas
          </button>
          <button className="nav-tab" aria-current={tab === 'rehearsal'} onClick={() => setTab('rehearsal')}>
            <span className="roman">III</span> Rehearsal
            {dueCount > 0 && <span className="due-badge">{dueCount} due</span>}
          </button>
        </nav>
        <div className="masthead-tools">
          <button className="consult-btn" onClick={() => setPaletteOpen(true)}>
            Consult the index <kbd>⌘K</kbd>
          </button>
          <a className="back-demos" href="https://tejas-live-demos.vercel.app">← Back to demos</a>
        </div>
      </header>

      <div className={`folio${tab === 'index' ? ' index-view' : ''}`}>
        {tab === 'index' && (
          <>
            <div className={`catalogue${listCollapsed ? ' collapsed' : ''}`}>
              <div className="catalogue-head">
                <h2>Card Catalogue</h2>
                <span className="catalogue-count">{notes.length} entries</span>
                <button className="mobile-list-toggle" onClick={() => setListCollapsed((v) => !v)}>
                  {listCollapsed ? 'Show list' : 'Hide list'}
                </button>
              </div>
              <div className="catalogue-filter">
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="FILTER BY TITLE…"
                  aria-label="Filter notes by title"
                />
              </div>
              <div className="catalogue-list">
                {notesLoading && (
                  <div aria-hidden="true">
                    <div className="skeleton line" />
                    <div className="skeleton line short" />
                    <div className="skeleton line" />
                    <div className="skeleton line short" />
                  </div>
                )}
                {!notesLoading && filtered.map((n) => (
                  <button
                    key={n.id}
                    className={`entry${selectedId === n.id ? ' active' : ''}`}
                    onClick={() => openNote(n.id)}
                  >
                    <span className="entry-no">
                      <span>No. {String(n.id).padStart(3, '0')}</span>
                      <span>{fmtDate(n.updated_at)}</span>
                    </span>
                    <span className="entry-title">{n.title || 'Untitled'}</span>
                  </button>
                ))}
                {!notesLoading && filtered.length === 0 && (
                  <p className="margin-empty" style={{ padding: '14px 16px' }}>
                    {filter ? 'No entry bears that title.' : 'The catalogue is empty — file the first entry.'}
                  </p>
                )}
              </div>
              <div className="catalogue-foot">
                <button className="btn primary" onClick={handleCreate}>+ File a new entry</button>
                <button className="btn quiet" onClick={() => setShowUpload((v) => !v)}>
                  {showUpload ? 'Close accession' : 'Accession a document'}
                </button>
                {showUpload && <UploadZone onUploaded={() => { setShowUpload(false); loadNotes() }} />}
              </div>
            </div>

            <main className="desk">
              {!detail && (
                <div className="frontispiece">
                  <div className="kicker">Frontispiece</div>
                  <h1>Terra Cognita</h1>
                  <div className="rule" />
                  <p>
                    Every note is a territory; every [[wikilink]] a surveyed route between them.
                    Write, connect, and rehearse — the atlas of your mind draws itself.
                  </p>
                  <button className="btn primary" onClick={handleCreate}>+ File the first entry of the day</button>
                </div>
              )}

              {detail && (
                <article className="sheet">
                  <div className="sheet-bar">
                    <button className="btn primary" onClick={handleSave} disabled={!dirty || saving}>
                      {saving ? 'Inking…' : 'Save'}
                    </button>
                    <button className="btn quiet" onClick={() => { setSelectedId(null); setListCollapsed(false) }}>Close</button>
                    <button className="btn quiet danger" onClick={handleDelete}>Strike out</button>
                    <span className="spacer" />
                    <span className={`sheet-status${dirty ? ' dirty' : ''}`} role="status">
                      {saving ? 'saving…' : dirty ? 'unsaved · ⌘S' : 'all saved'}
                    </span>
                  </div>
                  <input
                    className="title-input"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
                    placeholder="Untitled"
                    aria-label="Note title"
                  />
                  <div className="sheet-meta">
                    No. {String(detail.id).padStart(3, '0')} · filed {fmtDate(detail.created_at)}
                    {detail.tags.length > 0 && <> · {detail.tags.map((t) => `#${t}`).join('  ')}</>}
                  </div>
                  <Editor
                    content={content}
                    onChange={(html) => { setContent(html); setDirty(true) }}
                    onWikilink={handleWikilink}
                  />
                </article>
              )}
            </main>

            {detail && (
              <Marginalia
                detail={detail}
                onNavigate={openNote}
                onCardCreated={(card: Flashcard) => {
                  setDetail((d) => (d ? { ...d, flashcards: [...d.flashcards, card] } : d))
                  loadStats()
                }}
              />
            )}
          </>
        )}

        {tab === 'atlas' && <AtlasGraph onSelectNote={openNote} focusNoteId={selectedId} />}

        {tab === 'rehearsal' && <Rehearsal onReviewed={loadStats} />}
      </div>

      <button className="mobile-consult" onClick={() => setPaletteOpen(true)} aria-label="Search notes">✦</button>

      {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} onSelect={openNote} />}
    </div>
  )
}

import { useState } from 'react'
import { createFlashcard } from '../api'
import type { NoteDetail, Flashcard } from '../types'

export default function Marginalia({
  detail,
  onNavigate,
  onCardCreated,
}: {
  detail: NoteDetail
  onNavigate: (id: number) => void
  onCardCreated: (card: Flashcard) => void
}) {
  const [q, setQ] = useState('')
  const [a, setA] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim() || !a.trim() || busy) return
    setBusy(true)
    try {
      const card = await createFlashcard(detail.id, q.trim(), a.trim())
      onCardCreated(card)
      setQ('')
      setA('')
    } catch (err) {
      console.error(err)
    }
    setBusy(false)
  }

  return (
    <aside className="marginalia" aria-label="Note marginalia">
      <section className="margin-section">
        <h3 className="margin-title">Cited by <span className="n">{detail.backlinks.length}</span></h3>
        {detail.backlinks.length === 0 && <p className="margin-empty">No other entry cites this one yet.</p>}
        {detail.backlinks.map((b) => (
          <button key={`${b.note_id}-${b.type}`} className="margin-item" onClick={() => onNavigate(b.note_id)}>
            <span className="t">{b.title}</span>
            <span className="m">{b.type === 'linked' ? '⌁ wikilinked' : '§ mentioned'}</span>
          </button>
        ))}
      </section>

      <section className="margin-section">
        <h3 className="margin-title">Adjacent territory <span className="n">{detail.suggestions.length}</span></h3>
        {detail.suggestions.length === 0 && <p className="margin-empty">No nearby entries surveyed yet.</p>}
        {detail.suggestions.map((s) => (
          <button key={s.note_id} className="margin-item" onClick={() => onNavigate(s.note_id)}>
            <span className="t">{s.title}</span>
            <span className="m">
              <span className="sim-meter" aria-hidden="true"><i style={{ width: `${Math.round(Math.min(1, Math.max(0, s.similarity_score)) * 100)}%` }} /></span>
              {Math.round(Math.min(1, Math.max(0, s.similarity_score)) * 100)}%
            </span>
          </button>
        ))}
      </section>

      <section className="margin-section">
        <h3 className="margin-title">Rehearsal cards <span className="n">{detail.flashcards.length}</span></h3>
        {detail.flashcards.map((fc) => (
          <div key={fc.id} className="margin-card">
            <div className="q">{fc.question}</div>
            <div className="a">{fc.answer}</div>
          </div>
        ))}
        <form className="card-form" onSubmit={handleCreate}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Question to rehearse…"
            aria-label="Flashcard question"
          />
          <input
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="The answer…"
            aria-label="Flashcard answer"
          />
          <button className="btn quiet" type="submit" disabled={busy || !q.trim() || !a.trim()}>
            {busy ? 'Filing…' : '+ File a card'}
          </button>
        </form>
      </section>
    </aside>
  )
}

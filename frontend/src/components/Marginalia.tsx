import { useEffect, useState } from 'react'
import { createFlashcard, generateFlashcards } from '../api'
import type { NoteDetail, Flashcard, FlashcardSuggestion } from '../types'

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
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState('')
  const [suggestions, setSuggestions] = useState<FlashcardSuggestion[]>([])

  useEffect(() => {
    setSuggestions([])
    setDraftError('')
  }, [detail.id])

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

  async function handleDraft() {
    if (drafting) return
    setDrafting(true)
    setDraftError('')
    try {
      setSuggestions(await generateFlashcards(detail.id))
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Card drafting failed')
    } finally {
      setDrafting(false)
    }
  }

  async function acceptSuggestion(index: number) {
    const suggestion = suggestions[index]
    if (!suggestion) return
    try {
      const card = await createFlashcard(detail.id, suggestion.question, suggestion.answer)
      onCardCreated(card)
      setSuggestions((current) => current.filter((_, itemIndex) => itemIndex !== index))
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Could not file this card')
    }
  }

  return (
    <aside className="marginalia" aria-label="Note marginalia">
      <section className="margin-section">
        <h3 className="margin-title">What links here <span className="n">{detail.backlinks.length}</span></h3>
        {detail.backlinks.length === 0 && <p className="margin-empty">No routes lead here yet.</p>}
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
        <button className="btn quiet draft-cards-btn" type="button" onClick={handleDraft} disabled={drafting}>
          {drafting ? 'Consulting the note…' : '✦ Draft cards from this note'}
        </button>
        {draftError && <p className="margin-error" role="alert">{draftError}</p>}
        {suggestions.length > 0 && (
          <div className="card-suggestions" aria-label="Draft flashcards">
            {suggestions.map((suggestion, index) => (
              <article className="card-suggestion" key={`${suggestion.question}-${index}`}>
                <div className="q">{suggestion.question}</div>
                <div className="a">{suggestion.answer}</div>
                <div className="suggestion-actions">
                  <button className="btn primary" type="button" onClick={() => acceptSuggestion(index)}>Accept</button>
                  <button className="btn quiet" type="button" onClick={() => setSuggestions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Discard</button>
                </div>
              </article>
            ))}
          </div>
        )}
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

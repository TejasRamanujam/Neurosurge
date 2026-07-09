import { useCallback, useEffect, useState } from 'react'
import { fetchDueFlashcards, fetchFlashcardStats, reviewFlashcard } from '../api'
import type { Flashcard, FlashcardStats } from '../types'

const RATINGS: { n: number; label: string; low?: boolean; high?: boolean }[] = [
  { n: 0, label: 'Blackout', low: true },
  { n: 1, label: 'Wrong', low: true },
  { n: 2, label: 'Hard', low: true },
  { n: 3, label: 'Good', high: true },
  { n: 4, label: 'Easy', high: true },
  { n: 5, label: 'Perfect', high: true },
]

export default function Rehearsal({ onReviewed }: { onReviewed?: () => void }) {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [stats, setStats] = useState<FlashcardStats>({ total: 0, due: 0, reviewed_today: 0 })
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dueCards, s] = await Promise.all([fetchDueFlashcards(), fetchFlashcardStats()])
      setCards(dueCards)
      setStats(s)
      setIndex(0)
      setFlipped(false)
      setDone(dueCards.length === 0)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleRate = useCallback(async (r: number) => {
    const card = cards[index]
    if (!card || rating) return
    setRating(true)
    try {
      await reviewFlashcard(card.id, r)
      setStats((s) => ({ ...s, reviewed_today: s.reviewed_today + 1, due: Math.max(0, s.due - 1) }))
      onReviewed?.()
      if (index < cards.length - 1) {
        setIndex((i) => i + 1)
        setFlipped(false)
      } else {
        setDone(true)
      }
    } catch (err) {
      console.error(err)
    }
    setRating(false)
  }, [cards, index, rating, onReviewed])

  // keyboard: space flips, 0–5 rates
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (done || loading) return
      if (e.key === ' ' && !flipped) { e.preventDefault(); setFlipped(true) }
      else if (flipped && /^[0-5]$/.test(e.key)) { e.preventDefault(); handleRate(Number(e.key)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, done, loading, handleRate])

  const card = cards[index]

  return (
    <div className="rehearsal">
      <div className="rehearsal-inner">
        <header className="rehearsal-head">
          <div className="plate-no">Plate III</div>
          <h2>The Rehearsal Room</h2>
          <div className="rehearsal-stats">
            <span><b>{stats.reviewed_today}</b> recalled today</span>
            <span><b>{done ? 0 : cards.length - index}</b> due</span>
            <span><b>{stats.total}</b> in the deck</span>
          </div>
        </header>

        {loading && <div className="spinner-line">Shuffling the card drawer…</div>}

        {!loading && done && (
          <div className="rehearsal-done">
            <div className="seal">✓</div>
            <h3>Nothing left to recall.</h3>
            <p>Every card that was due has been rehearsed. The atlas remembers what you practice.</p>
            <button className="btn" onClick={loadData}>Check the drawer again</button>
          </div>
        )}

        {!loading && !done && card && (
          <>
            <div
              className={`index-card${flipped ? ' flipped' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={flipped ? 'Answer shown' : 'Question card — press Space or click to reveal the answer'}
              onClick={() => { if (!flipped) setFlipped(true) }}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !flipped) { e.preventDefault(); setFlipped(true) } }}
            >
              <span className="card-side-label">{flipped ? 'Verso — answer' : 'Recto — question'}</span>
              <span className="card-count-label">{index + 1} / {cards.length}</span>
              <div className={`card-face${flipped ? ' answer' : ''}`}>
                <div className="text">{flipped ? card.answer : card.question}</div>
              </div>
              {!flipped && <div className="card-flip-hint">space / click to turn the card</div>}
            </div>

            {flipped && (
              <div className="rating-row" role="group" aria-label="Rate your recall, 0 to 5">
                {RATINGS.map((r) => (
                  <button
                    key={r.n}
                    className={`rating-btn${r.low ? ' low' : ''}${r.high ? ' high' : ''}`}
                    onClick={() => handleRate(r.n)}
                    disabled={rating}
                  >
                    <span className="num">{r.n}</span>
                    <span className="lbl">{r.label}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="review-track" aria-hidden="true">
              <i style={{ width: `${(index / Math.max(1, cards.length)) * 100}%` }} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

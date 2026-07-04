import { useState, useEffect, useCallback } from 'react'
import { fetchDueFlashcards, reviewFlashcard, fetchFlashcardStats } from '../../api'
import type { Flashcard, FlashcardStats } from '../../types'

export default function FlashcardReview() {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [stats, setStats] = useState<FlashcardStats>({ total: 0, due: 0, reviewed_today: 0 })
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [dueCards, flashcardStats] = await Promise.all([fetchDueFlashcards(), fetchFlashcardStats()])
      setCards(dueCards)
      setStats(flashcardStats)
      setIndex(0)
      setFlipped(false)
      setDone(dueCards.length === 0)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const handleRate = useCallback(async (rating: number) => {
    if (!cards[index]) return
    try {
      await reviewFlashcard(cards[index].id, rating)
      if (index < cards.length - 1) { setIndex((i) => i + 1); setFlipped(false) }
      else setDone(true)
    } catch (err) { console.error(err) }
  }, [cards, index])

  if (loading) {
    return (
      <div aria-busy="true">
        <div className="flashcard-progress"><span>Loading due cards...</span></div>
        <div className="skeleton skeleton-card" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="empty-state">
        <div className="icon">✓</div>
        <h3>All caught up!</h3>
        <p>You've reviewed every card that's due. Your memory graph thanks you.</p>
        <div className="flashcard-progress">
          <span>{stats.reviewed_today} reviewed today</span>
          <span>·</span>
          <span>{stats.total} total</span>
        </div>
        <button className="graph-btn" style={{ marginTop: 16 }} onClick={loadData}>Refresh</button>
      </div>
    )
  }

  const card = cards[index]
  return (
    <div>
      <div className="flashcard-progress">
        <span>{stats.reviewed_today} today</span>
        <span>·</span>
        <span>{index + 1} / {cards.length}</span>
        <span>·</span>
        <span>{stats.total} total</span>
      </div>
      <div className={`flashcard${flipped ? ' flipped' : ''}`} onClick={() => { if (!flipped) setFlipped(true) }}>
        {!flipped ? (
          <>
            <div className="question">{card?.question}</div>
            <div className="hint">Click to reveal</div>
          </>
        ) : (
          <div className="answer">{card?.answer}</div>
        )}
      </div>
      {flipped && (
        <div className="rating-buttons">
          <button className="rating-btn r0" onClick={() => handleRate(0)} title="Blackout">0</button>
          <button className="rating-btn r1" onClick={() => handleRate(1)} title="Wrong">1</button>
          <button className="rating-btn r2" onClick={() => handleRate(2)} title="Hard">2</button>
          <button className="rating-btn r3" onClick={() => handleRate(3)} title="Good">3</button>
          <button className="rating-btn r4" onClick={() => handleRate(4)} title="Easy">4</button>
          <button className="rating-btn r5" onClick={() => handleRate(5)} title="Perfect">5</button>
        </div>
      )}
      <div className="review-progress-track">
        <div className="review-progress-fill" style={{ width: `${(index / cards.length) * 100}%` }} />
      </div>
    </div>
  )
}

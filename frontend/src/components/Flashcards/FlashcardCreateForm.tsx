import { useState } from 'react'
import { createFlashcard } from '../../api'
import type { Flashcard } from '../../types'

interface FlashcardCreateProps {
  noteId: number
  onCreated: (card: Flashcard) => void
}

export default function FlashcardCreateForm({ noteId, onCreated }: FlashcardCreateProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || !answer.trim()) return
    setSaving(true)
    try {
      const card = await createFlashcard(noteId, question, answer)
      onCreated(card)
      setQuestion('')
      setAnswer('')
    } catch (err) {
      console.error('Failed to create flashcard:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="flashcard-form" onSubmit={handleSubmit}>
      <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>New Card</h4>
      <input
        type="text"
        placeholder="Question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <textarea
        placeholder="Answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
      />
      <button type="submit" className="editor-btn save" disabled={saving || !question.trim() || !answer.trim()}>
        {saving ? 'Saving...' : 'Add Card'}
      </button>
    </form>
  )
}

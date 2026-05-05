import type { Flashcard } from '../../types'
import FlashcardCreateForm from '../Flashcards/FlashcardCreateForm'

interface NoteFlashcardsProps {
  noteId: number
  flashcards: Flashcard[]
  onFlashcardCreated: (card: Flashcard) => void
}

export default function NoteFlashcards({ noteId, flashcards, onFlashcardCreated }: NoteFlashcardsProps) {
  return (
    <div>
      {flashcards.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
            Flashcards ({flashcards.length})
          </h4>
          {flashcards.map((fc) => (
            <div key={fc.id} className="context-item" style={{ cursor: 'default' }}>
              <h4>{fc.question}</h4>
              <p>{fc.answer}</p>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Ease: {fc.ease} · Interval: {fc.interval}d · Reps: {fc.repetitions}
              </div>
            </div>
          ))}
        </div>
      )}
      <FlashcardCreateForm noteId={noteId} onCreated={onFlashcardCreated} />
    </div>
  )
}

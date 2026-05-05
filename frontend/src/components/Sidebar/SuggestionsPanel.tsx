import type { Suggestion } from '../../types'

interface SuggestionsPanelProps {
  suggestions: Suggestion[]
  onNavigate: (noteId: number) => void
}

export default function SuggestionsPanel({ suggestions, onNavigate }: SuggestionsPanelProps) {
  if (suggestions.length === 0) {
    return (
      <div style={{ padding: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
          No suggestions yet. Add more content to get AI-powered connections.
        </p>
      </div>
    )
  }

  return (
    <div>
      {suggestions.map((s) => (
        <div key={s.note_id} className="context-item" onClick={() => onNavigate(s.note_id)}>
          <h4>{s.title}</h4>
          <p>{s.reason}</p>
          <div className="score">{(s.similarity_score * 100).toFixed(0)}% match</div>
        </div>
      ))}
    </div>
  )
}

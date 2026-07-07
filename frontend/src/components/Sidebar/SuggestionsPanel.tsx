import type { Suggestion } from '../../types'

interface SuggestionsPanelProps {
  suggestions: Suggestion[]
  onNavigate: (noteId: number) => void
}

export default function SuggestionsPanel({ suggestions, onNavigate }: SuggestionsPanelProps) {
  if (suggestions.length === 0) {
    return (
      <div className="panel-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
          <path d="M14 10l3.5-3.5M14 14l3.5 3.5M10 14l-3.5 3.5" />
        </svg>
        <p>No related notes yet. Write more and similar ideas will surface here automatically.</p>
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

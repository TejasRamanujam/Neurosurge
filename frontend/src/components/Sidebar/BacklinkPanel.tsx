import type { Backlink } from '../../types'

interface BacklinkPanelProps {
  backlinks: Backlink[]
  onNavigate: (noteId: number) => void
}

export default function BacklinkPanel({ backlinks, onNavigate }: BacklinkPanelProps) {
  if (backlinks.length === 0) {
    return (
      <div className="panel-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <p>No backlinks yet. Mention this note elsewhere and connections will appear here.</p>
      </div>
    )
  }

  return (
    <div>
      {backlinks.map((bl) => (
        <div key={bl.note_id} className="context-item" onClick={() => onNavigate(bl.note_id)}>
          <h4>{bl.title}</h4>
          <p>{bl.type === 'linked' ? 'Linked reference' : 'Unlinked mention'}</p>
        </div>
      ))}
    </div>
  )
}

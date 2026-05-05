import type { Backlink } from '../../types'

interface BacklinkPanelProps {
  backlinks: Backlink[]
  onNavigate: (noteId: number) => void
}

export default function BacklinkPanel({ backlinks, onNavigate }: BacklinkPanelProps) {
  if (backlinks.length === 0) {
    return (
      <div style={{ padding: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
          No backlinks yet
        </p>
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

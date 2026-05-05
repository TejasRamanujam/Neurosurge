import type { Note } from '../../types'

interface NoteCardProps {
  note: Note
  onClick: () => void
}

function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NoteCard({ note, onClick }: NoteCardProps) {
  const plainText = stripHtml(note.content)
  const preview = plainText.slice(0, 200)

  return (
    <div className="note-card" onClick={onClick}>
      <h3>{note.title || 'Untitled'}</h3>
      {preview && <p>{preview}</p>}
      <div className="meta">
        <span>{formatDate(note.updated_at)}</span>
        <span>{plainText.length} chars</span>
      </div>
    </div>
  )
}

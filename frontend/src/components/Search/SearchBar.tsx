import { useState, useRef, useEffect } from 'react'
import { searchNotes } from '../../api'
import type { SearchResult } from '../../types'

interface SearchBarProps {
  onSelectNote: (id: number) => void
}

export default function SearchBar({ onSelectNote }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    clearTimeout(timer.current)
    if (!value.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    timer.current = setTimeout(async () => {
      try {
        const data = await searchNotes(value)
        setResults(data)
        setOpen(data.length > 0)
      } catch {
        setResults([])
      }
    }, 300)
  }

  function handleSelect(noteId: number) {
    setOpen(false)
    setQuery('')
    onSelectNote(noteId)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Search notes..."
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true) }}
      />
      {open && (
        <div className="search-results">
          {results.map((r) => (
            <div key={r.id} className="search-result-item" onClick={() => handleSelect(r.id)}>
              <h4>{r.title}</h4>
              <p>{r.content_snippet}</p>
              <span className="match-badge">{r.match_type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

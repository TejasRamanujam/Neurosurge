import { useEffect, useRef, useState } from 'react'
import { searchNotes } from '../api'
import type { SearchResult } from '../types'

export default function Palette({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (id: number) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(0)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<number>(0)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    window.clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); setSearched(false); setBusy(false); return }
    setBusy(true)
    timer.current = window.setTimeout(async () => {
      try {
        const r = await searchNotes(q.trim())
        setResults(r)
        setActive(0)
        setSearched(true)
      } catch (err) {
        console.error(err)
      }
      setBusy(false)
    }, 280)
    return () => window.clearTimeout(timer.current)
  }, [q])

  const exact = results.filter((r) => r.match_type !== 'semantic')
  const semantic = results.filter((r) => r.match_type === 'semantic')
  const ordered = [...exact, ...semantic]

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(ordered.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && ordered[active]) { e.preventDefault(); onSelect(ordered[active].id) }
  }

  function renderResult(r: SearchResult, i: number) {
    return (
      <button
        key={r.id}
        className="result"
        role="option"
        aria-selected={i === active}
        onMouseEnter={() => setActive(i)}
        onClick={() => onSelect(r.id)}
      >
        <span className="rt">
          {r.title || 'Untitled'}
          {r.match_type === 'semantic' && (
            <span className="semantic-mark">≈ {Math.round(Math.min(1, Math.max(0, r.score)) * 100)}%</span>
          )}
        </span>
        <span className="rs">{r.content_snippet}</span>
      </button>
    )
  }

  return (
    <div className="veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Consult the index" onKeyDown={onKeyDown}>
        <div className="palette-head">
          <span className="glyph" aria-hidden="true">✦</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Consult the index… meaning counts, not just words"
            role="combobox"
            aria-expanded={ordered.length > 0}
            aria-label="Search notes"
          />
          {busy && <span className="mono" style={{ color: 'var(--ink-faint)' }} aria-live="polite">…</span>}
        </div>
        <div className="palette-body" role="listbox" aria-label="Search results">
          {!q.trim() && (
            <>
              <p className="palette-note">Type to search every entry — exact matches and semantic neighbours (Gemini embeddings).</p>
              <div className="palette-group">Try asking</div>
              {['how do I remember things longer', 'searching by meaning', 'why link notes together'].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="palette-note"
                  style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none' }}
                  onClick={() => setQ(ex)}
                >
                  “{ex}”
                </button>
              ))}
            </>
          )}
          {q.trim() !== '' && searched && !busy && ordered.length === 0 && (
            <p className="palette-note">Nothing in the index answers “{q}”.</p>
          )}
          {exact.length > 0 && <div className="palette-group">Exact matches</div>}
          {exact.map((r, i) => renderResult(r, i))}
          {semantic.length > 0 && <div className="palette-group">Semantic neighbours</div>}
          {semantic.map((r, i) => renderResult(r, exact.length + i))}
        </div>
        <div className="palette-foot">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}

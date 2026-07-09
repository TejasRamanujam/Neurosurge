import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchGraph } from '../api'
import type { KnowledgeGraph } from '../types'

/*
 * The Atlas: a hand-rolled canvas force layout rendered as a survey plate.
 * Wikilinks are solid ink routes; shared tags are dashed verdigris isopleths.
 */

const INK = '#26201a'
const INK_FAINT = 'rgba(38, 32, 26, 0.55)'
const PAPER_HIGH = '#f7f2e6'
const VERMILION = '#bf3b1f'
const SURVEY = '#2e5a52'

interface SimNode {
  id: number
  title: string
  tags: string[]
  degree: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

interface SimEdge {
  a: number // index into nodes
  b: number
  weight: number
  linked: boolean
}

interface Sim {
  nodes: SimNode[]
  edges: SimEdge[]
  alpha: number
  byId: Map<number, SimNode>
}

function buildSim(g: KnowledgeGraph): Sim {
  const n = g.nodes.length
  const nodes: SimNode[] = g.nodes.map((node, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2
    const rad = 160 + (i % 3) * 60
    return {
      id: node.id,
      title: node.title || 'Untitled',
      tags: node.tags || [],
      degree: node.connection_count || 0,
      x: Math.cos(angle) * rad + Math.sin(i * 7.3) * 40,
      y: Math.sin(angle) * rad + Math.cos(i * 4.7) * 40,
      vx: 0,
      vy: 0,
      r: 5 + Math.min(11, (node.connection_count || 0) * 1.5),
    }
  })
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]))
  const edges: SimEdge[] = []
  for (const e of g.edges) {
    const a = idx.get(e.source)
    const b = idx.get(e.target)
    if (a === undefined || b === undefined || a === b) continue
    edges.push({ a, b, weight: e.weight || 1, linked: e.relationship_type === 'linked' })
  }
  return { nodes, edges, alpha: 1, byId: new Map(nodes.map((nd) => [nd.id, nd])) }
}

function tick(sim: Sim) {
  const { nodes, edges } = sim
  const a = sim.alpha
  // pairwise repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const ni = nodes[i], nj = nodes[j]
      let dx = nj.x - ni.x, dy = nj.y - ni.y
      let d2 = dx * dx + dy * dy
      if (d2 < 1) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); d2 = 1 }
      const d = Math.sqrt(d2)
      const f = Math.min(12, 4200 / d2) * a
      const fx = (dx / d) * f, fy = (dy / d) * f
      ni.vx -= fx; ni.vy -= fy
      nj.vx += fx; nj.vy += fy
    }
  }
  // springs
  for (const e of edges) {
    const na = nodes[e.a], nb = nodes[e.b]
    const dx = nb.x - na.x, dy = nb.y - na.y
    const d = Math.max(1, Math.hypot(dx, dy))
    const rest = e.linked ? 130 : 190
    const k = (e.linked ? 0.035 : 0.012) * Math.min(2, e.weight)
    const f = (d - rest) * k * a
    const fx = (dx / d) * f, fy = (dy / d) * f
    na.vx += fx; na.vy += fy
    nb.vx -= fx; nb.vy -= fy
  }
  // centering gravity
  for (const nd of nodes) {
    nd.vx -= nd.x * 0.004 * a
    nd.vy -= nd.y * 0.004 * a
    nd.vx *= 0.82
    nd.vy *= 0.82
    nd.x += nd.vx
    nd.y += nd.vy
  }
  sim.alpha = Math.max(0, a * 0.985)
}

interface View { tx: number; ty: number; k: number }

export default function AtlasGraph({
  onSelectNote,
  focusNoteId,
}: {
  onSelectNote: (id: number) => void
  focusNoteId?: number | null
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<Sim | null>(null)
  const viewRef = useRef<View>({ tx: 0, ty: 0, k: 1 })
  const autoFitRef = useRef(true)
  const hoverRef = useRef<number>(-1) // node index
  const focusIdxRef = useRef<number>(-1) // keyboard focus index
  const dragRef = useRef<{ mode: 'none' | 'node' | 'pan'; nodeIdx: number; sx: number; sy: number; ox: number; oy: number; moved: boolean }>({ mode: 'none', nodeIdx: -1, sx: 0, sy: 0, ox: 0, oy: 0, moved: false })
  const rafRef = useRef(0)
  const dashRef = useRef(0)
  const reducedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [counts, setCounts] = useState({ notes: 0, routes: 0 })
  const [empty, setEmpty] = useState(false)
  const [hoverTitle, setHoverTitle] = useState<string | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const sim = simRef.current
    if (!canvas || !sim) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    if (autoFitRef.current && sim.nodes.length) {
      // fit world bounds into view with padding
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const nd of sim.nodes) {
        minX = Math.min(minX, nd.x); maxX = Math.max(maxX, nd.x)
        minY = Math.min(minY, nd.y); maxY = Math.max(maxY, nd.y)
      }
      const pad = 90
      const bw = Math.max(120, maxX - minX + pad * 2)
      const bh = Math.max(120, maxY - minY + pad * 2)
      const k = Math.min(2, Math.min(w / bw, h / bh))
      viewRef.current = {
        k,
        tx: w / 2 - ((minX + maxX) / 2) * k,
        ty: h / 2 - ((minY + maxY) / 2) * k,
      }
    }
    const { tx, ty, k } = viewRef.current

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // ---- graticule (survey grid in world space) ----
    const step = 90
    const x0 = (-tx) / k, y0 = (-ty) / k
    const x1 = (w - tx) / k, y1 = (h - ty) / k
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let gx = Math.floor(x0 / step) * step; gx <= x1; gx += step) {
      ctx.moveTo(gx * k + tx, 0); ctx.lineTo(gx * k + tx, h)
    }
    for (let gy = Math.floor(y0 / step) * step; gy <= y1; gy += step) {
      ctx.moveTo(0, gy * k + ty); ctx.lineTo(w, gy * k + ty)
    }
    ctx.strokeStyle = 'rgba(38, 32, 26, 0.055)'
    ctx.stroke()
    // graticule crosses at major intersections
    ctx.beginPath()
    const major = step * 3
    for (let gx = Math.floor(x0 / major) * major; gx <= x1; gx += major) {
      for (let gy = Math.floor(y0 / major) * major; gy <= y1; gy += major) {
        const sx = gx * k + tx, sy = gy * k + ty
        ctx.moveTo(sx - 5, sy); ctx.lineTo(sx + 5, sy)
        ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy + 5)
      }
    }
    ctx.strokeStyle = 'rgba(38, 32, 26, 0.18)'
    ctx.stroke()

    const hovered = hoverRef.current
    const focused = focusIdxRef.current
    const focusNode = focusNoteId != null ? sim.byId.get(focusNoteId) : undefined

    const incident = new Set<number>()
    if (hovered >= 0) {
      sim.edges.forEach((e, i) => { if (e.a === hovered || e.b === hovered) incident.add(i) })
    }

    // ---- edges ----
    for (let i = 0; i < sim.edges.length; i++) {
      const e = sim.edges[i]
      const na = sim.nodes[e.a], nb = sim.nodes[e.b]
      const ax = na.x * k + tx, ay = na.y * k + ty
      const bx = nb.x * k + tx, by = nb.y * k + ty
      const hot = incident.has(i)
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      if (e.linked) {
        ctx.setLineDash([])
        ctx.lineWidth = Math.min(3, 1 + e.weight * 0.5)
        ctx.strokeStyle = hot ? VERMILION : 'rgba(38, 32, 26, 0.42)'
      } else {
        ctx.setLineDash([5, 5])
        ctx.lineDashOffset = -dashRef.current
        ctx.lineWidth = 1.1
        ctx.strokeStyle = hot ? VERMILION : 'rgba(46, 90, 82, 0.42)'
      }
      if (hot) ctx.lineWidth += 0.6
      ctx.stroke()
    }
    ctx.setLineDash([])

    // ---- nodes ----
    ctx.textAlign = 'center'
    for (let i = 0; i < sim.nodes.length; i++) {
      const nd = sim.nodes[i]
      const sx = nd.x * k + tx, sy = nd.y * k + ty
      const r = Math.max(3.5, nd.r * Math.min(1.25, Math.max(0.65, k)))
      const isHover = i === hovered
      const isFocusKb = i === focused
      const isSelected = focusNode?.id === nd.id

      // halo for hovered / selected
      if (isHover || isSelected || isFocusKb) {
        ctx.beginPath()
        ctx.arc(sx, sy, r + 7, 0, Math.PI * 2)
        ctx.strokeStyle = isHover || isFocusKb ? VERMILION : 'rgba(191, 59, 31, 0.55)'
        ctx.lineWidth = 1.2
        ctx.setLineDash(isFocusKb && !isHover ? [3, 3] : [])
        ctx.stroke()
        ctx.setLineDash([])
        // crosshair ticks — the "you are here" survey mark
        ctx.beginPath()
        for (const [dx2, dy2] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
          ctx.moveTo(sx + dx2 * (r + 7), sy + dy2 * (r + 7))
          ctx.lineTo(sx + dx2 * (r + 12), sy + dy2 * (r + 12))
        }
        ctx.strokeStyle = VERMILION
        ctx.stroke()
      }

      // plotted point: paper ring + ink core
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fillStyle = PAPER_HIGH
      ctx.fill()
      ctx.strokeStyle = isHover || isSelected ? VERMILION : INK
      ctx.lineWidth = 1.4
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(1.6, r - 3.4), 0, Math.PI * 2)
      ctx.fillStyle = isHover || isSelected ? VERMILION : INK
      ctx.fill()

      // label
      const showLabel = k > 0.42 || isHover || isSelected || nd.degree >= 4
      if (showLabel) {
        const label = nd.title.length > 26 ? nd.title.slice(0, 26) + '…' : nd.title
        ctx.font = `500 10px "IBM Plex Mono", monospace`
        const upper = label.toUpperCase()
        const tw = ctx.measureText(upper).width
        // paper backing so labels stay legible over grid lines
        ctx.fillStyle = 'rgba(239, 232, 216, 0.82)'
        ctx.fillRect(sx - tw / 2 - 3, sy + r + 6, tw + 6, 13)
        ctx.fillStyle = isHover || isSelected ? VERMILION : INK_FAINT
        ctx.fillText(upper, sx, sy + r + 16)
      }
    }
  }, [focusNoteId])

  const loop = useCallback(() => {
    const sim = simRef.current
    if (!sim) return
    const settling = sim.alpha > 0.012
    if (settling) tick(sim)
    if (!reducedRef.current) dashRef.current = (dashRef.current + 0.25) % 1000
    draw()
    if (settling || !reducedRef.current) {
      rafRef.current = requestAnimationFrame(loop)
    }
  }, [draw])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const g = await fetchGraph()
      const sim = buildSim(g)
      simRef.current = sim
      autoFitRef.current = true
      setCounts({ notes: g.nodes.length, routes: g.edges.length })
      setEmpty(g.nodes.length === 0)
      if (reducedRef.current) {
        // settle instantly
        while (sim.alpha > 0.012) tick(sim)
      }
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      console.error(err)
      setError(true)
    }
    setLoading(false)
  }, [loop])

  // resize handling
  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = wrap.clientWidth * dpr
      canvas.height = wrap.clientHeight * dpr
      canvas.style.width = wrap.clientWidth + 'px'
      canvas.style.height = wrap.clientHeight + 'px'
      draw()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [draw])

  useEffect(() => {
    load()
    return () => cancelAnimationFrame(rafRef.current)
  }, [load])

  // ---- pointer interactions ----
  function toWorld(sx: number, sy: number) {
    const { tx, ty, k } = viewRef.current
    return { x: (sx - tx) / k, y: (sy - ty) / k }
  }

  function hitNode(sx: number, sy: number): number {
    const sim = simRef.current
    if (!sim) return -1
    const { k } = viewRef.current
    const p = toWorld(sx, sy)
    for (let i = sim.nodes.length - 1; i >= 0; i--) {
      const nd = sim.nodes[i]
      const r = (Math.max(3.5, nd.r * Math.min(1.25, Math.max(0.65, k))) + 6) / k
      if ((nd.x - p.x) ** 2 + (nd.y - p.y) ** 2 <= r * r) return i
    }
    return -1
  }

  function pos(e: React.PointerEvent | React.WheelEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top }
  }

  function requestFrame() {
    if (reducedRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => draw())
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    const { sx, sy } = pos(e)
    canvasRef.current?.setPointerCapture(e.pointerId)
    const idx = hitNode(sx, sy)
    dragRef.current = { mode: idx >= 0 ? 'node' : 'pan', nodeIdx: idx, sx, sy, ox: sx, oy: sy, moved: false }
  }

  function onPointerMove(e: React.PointerEvent) {
    const { sx, sy } = pos(e)
    const d = dragRef.current
    const sim = simRef.current
    if (!sim) return
    if (d.mode === 'node' && d.nodeIdx >= 0) {
      const { k } = viewRef.current
      const nd = sim.nodes[d.nodeIdx]
      nd.x += (sx - d.sx) / k
      nd.y += (sy - d.sy) / k
      nd.vx = 0; nd.vy = 0
      sim.alpha = Math.max(sim.alpha, 0.12)
      autoFitRef.current = false
      d.sx = sx; d.sy = sy
      if (Math.hypot(sx - d.ox, sy - d.oy) > 4) d.moved = true
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(loop)
    } else if (d.mode === 'pan') {
      viewRef.current.tx += sx - d.sx
      viewRef.current.ty += sy - d.sy
      autoFitRef.current = false
      d.sx = sx; d.sy = sy
      d.moved = true
      requestFrame()
    } else {
      const idx = hitNode(sx, sy)
      if (idx !== hoverRef.current) {
        hoverRef.current = idx
        setHoverTitle(idx >= 0 ? sim.nodes[idx].title : null)
        canvasRef.current!.style.cursor = idx >= 0 ? 'pointer' : 'grab'
        requestFrame()
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = dragRef.current
    const sim = simRef.current
    if (sim && d.mode === 'node' && !d.moved && d.nodeIdx >= 0) {
      onSelectNote(sim.nodes[d.nodeIdx].id)
    }
    dragRef.current = { mode: 'none', nodeIdx: -1, sx: 0, sy: 0, ox: 0, oy: 0, moved: false }
  }

  function onWheel(e: React.WheelEvent) {
    const { sx, sy } = pos(e)
    const v = viewRef.current
    const factor = Math.exp(-e.deltaY * 0.0016)
    const nk = Math.min(4, Math.max(0.25, v.k * factor))
    // zoom about cursor
    v.tx = sx - ((sx - v.tx) / v.k) * nk
    v.ty = sy - ((sy - v.ty) / v.k) * nk
    v.k = nk
    autoFitRef.current = false
    requestFrame()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const sim = simRef.current
    if (!sim || !sim.nodes.length) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      focusIdxRef.current = (focusIdxRef.current + 1) % sim.nodes.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      focusIdxRef.current = (focusIdxRef.current - 1 + sim.nodes.length) % sim.nodes.length
    } else if ((e.key === 'Enter' || e.key === ' ') && focusIdxRef.current >= 0) {
      e.preventDefault()
      onSelectNote(sim.nodes[focusIdxRef.current].id)
      return
    } else if (e.key === 'Escape') {
      focusIdxRef.current = -1
    } else {
      return
    }
    const i = focusIdxRef.current
    setHoverTitle(i >= 0 ? sim.nodes[i].title : null)
    // pan focused node into view center-ish if outside
    if (i >= 0) {
      const nd = sim.nodes[i]
      const canvas = canvasRef.current!
      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr, h = canvas.height / dpr
      const v = viewRef.current
      const sx = nd.x * v.k + v.tx, sy = nd.y * v.k + v.ty
      if (sx < 40 || sx > w - 40 || sy < 40 || sy > h - 40) {
        v.tx = w / 2 - nd.x * v.k
        v.ty = h / 2 - nd.y * v.k
        autoFitRef.current = false
      }
    }
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }

  return (
    <div className="atlas" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-label={`Knowledge atlas: ${counts.notes} notes, ${counts.routes} connections. Use arrow keys to move between notes, Enter to open one.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { hoverRef.current = -1; setHoverTitle(null); requestFrame() }}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onBlur={() => { focusIdxRef.current = -1; setHoverTitle(null); requestFrame() }}
      />

      {!loading && !error && !empty && (
        <div className="atlas-legend">
          <h3>Legend</h3>
          <div className="legend-row"><span className="legend-swatch" /> wikilink route</div>
          <div className="legend-row"><span className="legend-swatch dashed" /> shared-tag line</div>
          <div className="legend-hint">
            drag to survey · scroll to zoom<br />
            arrows + enter to navigate<br />
            {hoverTitle ? <span style={{ color: 'var(--vermilion)' }}>▸ {hoverTitle}</span> : 'click a point to open it'}
          </div>
        </div>
      )}

      <div className="atlas-actions">
        <button className="btn quiet" onClick={load}>Re-survey</button>
      </div>

      {!loading && !error && !empty && (
        <div className="atlas-cartouche">
          <div className="plate-no">Plate II</div>
          <h2>Atlas of Connections</h2>
          <div className="counts">{counts.notes} territories · {counts.routes} routes</div>
        </div>
      )}

      {loading && <div className="atlas-center"><div className="spinner-line">Surveying the territory…</div></div>}

      {error && (
        <div className="atlas-center">
          <h3>The survey failed</h3>
          <p>The atlas could not be charted. Your notes are safe — try again in a moment.</p>
          <button className="btn" onClick={load}>Try again</button>
        </div>
      )}

      {empty && !loading && !error && (
        <div className="atlas-center">
          <h3>Terra incognita</h3>
          <p>No territory charted yet. Write notes, join them with [[wikilinks]] and #tags, and the atlas draws itself.</p>
        </div>
      )}
    </div>
  )
}

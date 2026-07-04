import { useEffect, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { fetchGraph } from '../../api'
import type { KnowledgeGraph, GraphNode, GraphEdge } from '../../types'

interface D3Node extends GraphNode { x?: number; y?: number }
interface D3Edge extends GraphEdge { source: number; target: number }
interface GraphData { nodes: D3Node[]; links: D3Edge[] }

const ACCENT = '#7c5cff'
const ACCENT_LIGHT = '#937aff'
const CYAN = '#4cc9f0'
const TAG_COLORS: Record<string, string> = {
  'ml/ai': '#52d29a', ai: '#52d29a', productivity: '#ffb454',
  'full-stack': CYAN, knowledge: ACCENT, graph: '#c77dff',
  backend: '#2ec4b6', security: '#ff6b7a', cloud: CYAN,
}

export default function KnowledgeGraphView({
  onSelectNote,
  highlightNoteId,
}: {
  onSelectNote: (id: number) => void
  highlightNoteId?: number | null
}) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const fgRef = useRef<any>(null)

  useEffect(() => { loadGraph() }, [])

  async function loadGraph() {
    setError(false)
    try {
      const g: KnowledgeGraph = await fetchGraph()
      setData({
        nodes: g.nodes.map((n) => ({ ...n })),
        links: g.edges.map((e) => ({ ...e, source: e.source as number, target: e.target as number })),
      })
    } catch (err) {
      console.error(err)
      setError(true)
    }
    setLoading(false)
  }

  function handleZoomTo(id: number) {
    const node = data.nodes.find((n) => n.id === id)
    if (node && fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 600)
      fgRef.current.zoom(2.5, 600)
    }
  }

  useEffect(() => {
    if (highlightNoteId) handleZoomTo(highlightNoteId)
  }, [highlightNoteId, data])

  if (loading) return <div className="loading"><div className="spinner" />Mapping your knowledge graph...</div>

  if (error) {
    return (
      <div className="empty-state">
        <h3>Graph service is offline</h3>
        <p>The knowledge graph needs its backing graph database, which isn't reachable right now. Your notes are safe — try again in a moment.</p>
        <button className="graph-btn" onClick={loadGraph}>Try again</button>
      </div>
    )
  }

  if (data.nodes.length === 0) {
    return (
      <div className="empty-state">
        <h3>No connections yet</h3>
        <p>Create notes and link ideas — the graph builds itself as your second brain grows.</p>
        <button className="graph-btn" onClick={loadGraph}>Refresh</button>
      </div>
    )
  }

  return (
    <div className="graph-view">
      <div className="graph-controls">
        <button className="graph-btn" onClick={loadGraph}>Refresh</button>
        {highlightNoteId && (
          <button className="graph-btn" onClick={() => handleZoomTo(highlightNoteId)}>Focus</button>
        )}
      </div>

      <div className="graph-info">
        <span>{data.nodes.length} notes</span>
        <span>{data.links.length} connections</span>
      </div>

      <div className="graph-container">
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          nodeId="id"
          nodeLabel={(n: any) => n.title}
          nodeVal={(n: any) => Math.max(5, Math.min(22, (n.connection_count || 0) * 3 + 6))}
          nodeColor={(n: any) => {
            if (n.id === highlightNoteId) return ACCENT
            if (n.id === hovered) return ACCENT_LIGHT
            if (n.tags?.length) return TAG_COLORS[n.tags[0].toLowerCase()] || ACCENT
            return ACCENT
          }}
          linkWidth={(l: any) => Math.max(0.3, (l.weight || 1) * 1.5)}
          linkColor={() => 'rgba(124, 92, 255, 0.16)'}
          linkDirectionalParticles={(l: any) => (l.source === highlightNoteId || l.target === highlightNoteId) ? 2 : 0}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => CYAN}
          onNodeClick={(n: any) => onSelectNote(n.id)}
          onNodeHover={(n: any) => setHovered(n?.id ?? null)}
          backgroundColor="rgba(0,0,0,0)"
          d3AlphaDecay={0.015}
          d3VelocityDecay={0.25}
          cooldownTicks={120}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.title || ''
            const r = Math.max(5, Math.min(22, (node.connection_count || 0) * 3 + 6))
            const isHighlight = node.id === highlightNoteId
            const isHover = node.id === hovered
            const alpha = isHighlight ? 1 : isHover ? 0.9 : 0.7

            ctx.beginPath()
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
            const tag = node.tags?.[0]?.toLowerCase() || ''
            ctx.fillStyle = TAG_COLORS[tag] || ACCENT
            ctx.globalAlpha = alpha
            ctx.fill()

            if (isHighlight) {
              ctx.strokeStyle = CYAN
              ctx.lineWidth = 2.5 / globalScale
              ctx.stroke()
              ctx.beginPath()
              ctx.arc(node.x, node.y, r + 5 / globalScale, 0, 2 * Math.PI)
              ctx.strokeStyle = 'rgba(124, 92, 255, 0.25)'
              ctx.lineWidth = 2 / globalScale
              ctx.stroke()
            }

            if (isHover || isHighlight || globalScale > 0.5) {
              const fontSize = Math.max(11, 13 / globalScale)
              ctx.font = `${fontSize}px Inter, sans-serif`
              ctx.fillStyle = '#a4a9c0'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.globalAlpha = 1
              ctx.fillText(label.length > 22 ? label.slice(0, 22) + '…' : label, node.x, node.y + r + 3 / globalScale)
            }
            ctx.globalAlpha = 1
          }}
        />
      </div>
    </div>
  )
}

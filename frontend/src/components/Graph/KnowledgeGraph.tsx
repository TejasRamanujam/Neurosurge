import { useEffect, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { fetchGraph } from '../../api'
import type { KnowledgeGraph, GraphNode, GraphEdge } from '../../types'

interface D3Node extends GraphNode { x?: number; y?: number }
interface D3Edge extends GraphEdge { source: number; target: number }
interface GraphData { nodes: D3Node[]; links: D3Edge[] }

export default function KnowledgeGraphView({
  onSelectNote,
  highlightNoteId,
}: {
  onSelectNote: (id: number) => void
  highlightNoteId?: number | null
}) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<number | null>(null)
  const fgRef = useRef<any>(null)

  useEffect(() => { loadGraph() }, [])

  async function loadGraph() {
    try {
      const g: KnowledgeGraph = await fetchGraph()
      setData({
        nodes: g.nodes.map((n) => ({ ...n })),
        links: g.edges.map((e) => ({ ...e, source: e.source as number, target: e.target as number })),
      })
    } catch (err) { console.error(err) }
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

  if (loading) return <div className="loading"><div className="spinner" /></div>

  if (data.nodes.length === 0) {
    return (
      <div className="welcome-view">
        <h1>No connections yet</h1>
        <p>Create notes and the graph will automatically build as you add content.</p>
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
            if (n.id === highlightNoteId) return '#6c8cff'
            if (n.id === hovered) return '#8aa4ff'
            if (n.tags?.length) {
              const map: Record<string, string> = {
                'ml/ai': '#4caf50', ai: '#4caf50', productivity: '#ff9800',
                'full-stack': '#42a5f5', knowledge: '#6c8cff', graph: '#ab47bc',
                backend: '#26a69a', security: '#ef5350', cloud: '#42a5f5',
              }
              return map[n.tags[0].toLowerCase()] || '#6c8cff'
            }
            return '#6c8cff'
          }}
          linkWidth={(l: any) => Math.max(0.3, (l.weight || 1) * 1.5)}
          linkColor={() => 'rgba(108, 140, 255, 0.12)'}
          linkDirectionalParticles={(l: any) => (l.source === highlightNoteId || l.target === highlightNoteId) ? 2 : 0}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => '#6c8cff'}
          onNodeClick={(n: any) => onSelectNote(n.id)}
          onNodeHover={(n: any) => setHovered(n?.id ?? null)}
          backgroundColor="#1e1e1e"
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
            const map: Record<string, string> = {
              'ml/ai': '#4caf50', ai: '#4caf50', productivity: '#ff9800',
              'full-stack': '#42a5f5', knowledge: '#6c8cff', graph: '#ab47bc',
              backend: '#26a69a', security: '#ef5350', cloud: '#42a5f5',
            }
            ctx.fillStyle = map[tag] || '#6c8cff'
            ctx.globalAlpha = alpha
            ctx.fill()

            if (isHighlight) {
              ctx.strokeStyle = '#8aa4ff'
              ctx.lineWidth = 2.5 / globalScale
              ctx.stroke()
              ctx.beginPath()
              ctx.arc(node.x, node.y, r + 5 / globalScale, 0, 2 * Math.PI)
              ctx.strokeStyle = 'rgba(108, 140, 255, 0.2)'
              ctx.lineWidth = 2 / globalScale
              ctx.stroke()
            }

            if (isHover || isHighlight || globalScale > 0.5) {
              const fontSize = Math.max(11, 13 / globalScale)
              ctx.font = `${fontSize}px Inter, sans-serif`
              ctx.fillStyle = '#d4d4d4'
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

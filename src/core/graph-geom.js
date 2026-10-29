export const NODE_R = 24
export const ARROW = 9
export const MAX_CANVAS = 660
export const SCALE_CAP = 1.6
export const WEIGHT_OFFSET = 12

export function graphWidth(nodes) {
  if (!nodes.length) return 0
  return Math.max(...nodes.map((node) => node.x)) + NODE_R
}

export function graphHeight(nodes) {
  if (!nodes.length) return 0
  return Math.max(...nodes.map((node) => node.y)) + NODE_R
}

export function graphMaxWidth(nodes) {
  return Math.min(MAX_CANVAS, Math.round(graphWidth(nodes) * SCALE_CAP))
}

export function layoutNodes(nodes) {
  return nodes.map((node) => ({ ...node, cx: node.x, cy: node.y }))
}

export function edgeGeo(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const normal = [-uy, ux]
  const start = [a.x + ux * NODE_R, a.y + uy * NODE_R]
  const end = [b.x - ux * NODE_R, b.y - uy * NODE_R]
  const base = [end[0] - ux * ARROW, end[1] - uy * ARROW]
  const px = -uy * ARROW * 0.55
  const py = ux * ARROW * 0.55
  const head = [end, [base[0] + px, base[1] + py], [base[0] - px, base[1] - py]]
  const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
  return { start, end, base, head, mid, normal }
}

export function weightAt(geo, at = 0.5, side = 1) {
  return [
    geo.start[0] + (geo.end[0] - geo.start[0]) * at + geo.normal[0] * side * WEIGHT_OFFSET,
    geo.start[1] + (geo.end[1] - geo.start[1]) * at + geo.normal[1] * side * WEIGHT_OFFSET,
  ]
}

export function badgeAt(node) {
  return { cx: node.x - 17, cy: node.y - 17, r: 9.5 }
}

export function graphClickableGate(clickable, id) {
  return clickable.includes(id)
}

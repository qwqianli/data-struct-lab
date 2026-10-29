export const CELL = 52
export const CELL_GAP = 6
export const CELL_RX = 7
export const MAX_CANVAS = 860
export const SCALE_CAP = 1.6
export const DIR_ORDER = ['up', 'right', 'down', 'left']
export const DIRS = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] }

export function cellId(r, c) {
  return `g${r}-${c}`
}

export function cellLeft(c) {
  return c * (CELL + CELL_GAP)
}

export function cellTop(r) {
  return r * (CELL + CELL_GAP)
}

export function gridWidth(cols) {
  return cols * CELL + Math.max(0, cols - 1) * CELL_GAP
}

export function gridHeight(rows) {
  return rows * CELL + Math.max(0, rows - 1) * CELL_GAP
}

export function gridMaxWidth(cols) {
  return Math.min(MAX_CANVAS, Math.round(gridWidth(cols) * SCALE_CAP))
}

export function inBounds(r, c, rows, cols) {
  return r >= 0 && r < rows && c >= 0 && c < cols
}

export function neighbor(r, c, dir, rows, cols) {
  const delta = DIRS[dir]
  if (!delta) return null
  const nr = r + delta[0]
  const nc = c + delta[1]
  return inBounds(nr, nc, rows, cols) ? { r: nr, c: nc } : null
}

export function layoutCells(cells) {
  return cells.map((cell) => {
    const left = cellLeft(cell.c)
    const top = cellTop(cell.r)
    return { ...cell, left, top, cx: left + CELL / 2, cy: top + CELL / 2 }
  })
}

export function gridClickableGate(clickable, id) {
  return clickable.includes(id)
}

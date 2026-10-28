/**
 * TreeCanvas 的纯几何层 —— 零依赖、零 Vue、零算法语义。
 *
 * 布局层与推进层分离（定案 1）：这里只锁死「完全二叉树槽位」的坐标公式，
 * 不认识中序 / 层序 / DFS —— 推进单位写在各题引擎里。
 * 抽成独立模块的原因：selftest 是零依赖的 node 脚本，起不了 Vue，
 * 渲染器契约里凡能变成纯函数的（坐标、尺寸、门控、3.3 的给死数字）都从这里直采。
 *
 * 槽位模型：根在 d=1、k 从 0 起；(d,k) 的左孩子是 (d+1, 2k)、右孩子是 (d+1, 2k+1)。
 * 槽号 idx = 2^(d-1) - 1 + k，id = 's' + idx。
 */

// —— 格子与槽距 ——
export const CELL_W = 56
export const CELL_H = 44
export const CELL_RX = 8
export const SLOT_GAP = 66 // 槽距 = 56 + 10
export const PAD_LEFT = 62
export const TOP_Y = 56
export const LEVEL_H = 88 // 层间带 = 44（格）+ 44（走线）

// —— 3.3 给死的画法数字（selftest 逐条锁定）——
export const OUT_DX = 10 // 出边端口：左孩子从 x_p−10、右孩子从 x_p+10 出发
export const ARRIVE_LIFT = 6 // 入边到达 y = y(d+1) − 6，停在格子上方不进格子
export const ARROW_LEN = 8 // 实格入边箭头三角形边长
export const DASH_EDGE = '4 3' // 指向空格的边：虚线、不画箭头
export const DASH_CELL = '5 4' // 空格自己的虚线框
export const EDGE_W = 1.5 // 常规边线宽
export const PATH_W = 2 // 路径线线宽（不新画第三条曲线，只改既有斜线）
export const EMPTY_OPACITY = 0.6 // 空格虚线框透明度（不许降到 .35，深色底会看不见）
export const GUTTER_X = 26 // 深度标签 text-anchor:end 的 x
export const GUTTER_DY = 26 // 标签 y = y(d) + 26
export const LABEL_SIZE = 11 // 深度标签字号
export const EMPTY_FONT = 13 // 格内 ∅ 的字号

// —— 画布尺寸 ——
export const MAX_CANVAS = 860
export const SCALE_CAP = 1.6

export function slotIdx(d, k) {
  return 2 ** (d - 1) - 1 + k
}

export function slotId(d, k) {
  return `s${slotIdx(d, k)}`
}

/**
 * 槽位 x：完全二叉树第 d 层第 k 个槽的水平中心。
 * x(d,k) = 62 + 66 × ( k × 2^(L-d) + (2^(L-d) - 1) / 2 )
 * 锁死槽位 x 是定案 1 —— 不许换成中序投影或紧凑布局。
 */
export function slotX(d, k, levels) {
  const span = 2 ** (levels - d)
  return PAD_LEFT + SLOT_GAP * (k * span + (span - 1) / 2)
}

export function slotY(d) {
  return TOP_Y + (d - 1) * LEVEL_H
}

/** width = 58 + 66 × 2^(L-1)：L=3 → 322，L=4 → 586，L=5 → 1114 */
export function treeWidth(levels) {
  return 58 + SLOT_GAP * 2 ** (levels - 1)
}

/** height = 124 + (L-1) × 88：L=4 → 388。只由常量算，绝不从帧里最深处反推 */
export function treeHeight(levels) {
  return 124 + (levels - 1) * LEVEL_H
}

/**
 * maxWidth = min(860, width × 1.6)；noScale 为 true 时直接用原宽（scale = 1）。
 * L=5 时 scale 0.772 → 热区只剩 ≈43px，点击手感全没 —— 这就是深度硬锁的几何依据。
 */
export function treeMaxWidth(levels, { noScale = false } = {}) {
  if (noScale) return treeWidth(levels)
  return Math.min(MAX_CANVAS, Math.round(treeWidth(levels) * SCALE_CAP))
}

export function scaleOf(levels, opts = {}) {
  return treeMaxWidth(levels, opts) / treeWidth(levels)
}

/** 点击热区 = 56 × scale。L=4 ≈ 82px ✓ 上限，L=5 ≈ 43px ✗ 禁止 */
export function hotzone(levels, opts = {}) {
  return CELL_W * scaleOf(levels, opts)
}

// —— 3.3 出边 / 入边的端口（渲染器与 selftest 共用同一份函数）——

/** 出边端口的 x：左孩子从 x_p − 10 出发、右孩子从 x_p + 10（不偏则两条出线同线重叠） */
export function edgeStartX(xParent, side) {
  return side === 'L' ? xParent - OUT_DX : xParent + OUT_DX
}

/** 出边端口的 y：父格底边 */
export function edgeStartY(d) {
  return slotY(d) + CELL_H
}

/** 入边到达的 y：子格上方 6px，停在格子上方不进格子 */
export function edgeEndY(d) {
  return slotY(d) - ARRIVE_LIFT
}

/**
 * 点击门控：clickable 外的 id 不 emit。
 * 抽成纯函数（照 ListCanvas.vue:244-245 的语义），selftest 不起 Vue 就能锁行为。
 */
export function clickableGate(clickable, id) {
  return clickable.includes(id)
}

/** 槽号 → (d,k)：range 横条定位用 */
export function idxToDK(idx) {
  const d = Math.floor(Math.log2(idx + 1)) + 1
  return { d, k: idx - (2 ** (d - 1) - 1) }
}

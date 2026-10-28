<script setup>
import { computed } from 'vue'
import {
  CELL_W,
  CELL_H,
  CELL_RX,
  EMPTY_OPACITY,
  DASH_CELL,
  DASH_EDGE,
  EDGE_W,
  PATH_W,
  GUTTER_X,
  GUTTER_DY,
  LABEL_SIZE,
  clickableGate,
  hotzone,
  layoutCells,
  layoutEdges,
  rangeBarRect,
  scaleOf,
  slotX,
  slotY,
  treeHeight,
  treeMaxWidth,
  treeWidth,
} from '../core/tree-geom.js'

/**
 * 树渲染器（SVG）—— 布局层，不带任何算法语义。
 *
 * 只认 id、坐标、kind：不认识「中序」「栈顶」，推进单位写在各题引擎里。
 * 坐标锁死完全二叉树槽位 x（定案 1）：斜树 50% 利用率是已接受代价，
 * 换中序投影或紧凑布局都会推翻以槽位 x 为题眼的演示。
 *
 * 空节点按槽位恒定预留：空格与实格同尺寸同坐标，缺失孩子画虚线格；
 * 空格自己不生孩子，深度 = L 的节点的孩子不进画面（由引擎保证，渲染器照画）。
 *
 * 热区链：width 由 levels 算出 → maxWidth = min(860, width×1.6) → viewBox 缩放，
 * 热区 = 56 × scale。L=4 是 860 封顶下热区 ≥80px 的最后一档，L=5 禁止。
 * height / levels 只由常量算，绝不从当前帧最深处反推 —— 否则翻页长高、箭头全错位。
 */
const props = defineProps({
  cells: { type: Array, required: true }, // [{ id, value:number|null, d, k, empty }] 实格与空格同构
  edges: { type: Array, default: () => [] }, // [{ from, to, kind:'normal'|'path'|'null' }] path = 当前 DFS 路径
  pointers: { type: Array, default: () => [] }, // [{ name, at }] at 是格子 id 或 null（悬空 → 左下角一行）
  marks: { type: Object, default: () => ({}) }, // { [id]:'active'|'ok' }
  clickable: { type: Array, default: () => [] }, // 格子 id 数组（不是 Boolean，门控照 ListCanvas）
  levels: { type: Number, required: true }, // L，只用于算 height 与槽位
  range: { type: Object, default: null }, // { lo, hi } 槽号闭区间 → 画布底部横条
  noScale: { type: Boolean, default: false }, // true → maxWidth = width（scale 1）
})

const emit = defineEmits(['node-click'])

const width = computed(() => treeWidth(props.levels))
const height = computed(() => treeHeight(props.levels))
const maxWidth = computed(() => treeMaxWidth(props.levels, { noScale: props.noScale }))
const scale = computed(() => scaleOf(props.levels, { noScale: props.noScale }))

// 热区只作 data 属性留给调试与断言对照，不参与渲染
const hotzonePx = computed(() => hotzone(props.levels, { noScale: props.noScale }))

// 只用来按 id 查 d/k（tags 定位用）。cells 里没有坐标字段 —— 渲染位置一律走 layoutCells/layoutEdges，
// 不许从这里取 .x（P9a-1 修补单的根因就是两条数据源：这里取过一次 .x，全是 NaN）
const posById = computed(() => new Map(props.cells.map((c) => [c.id, c])))

/** 格子定位：x 只由 (d, k, L) 决定，与帧内容无关 —— 同一数据集全程恒定。 */
const placedCells = computed(() => layoutCells(props.cells, props.levels))

/**
 * 边的几何（含箭头三角）：端点全部由 slotX/slotY 现算，实现在 tree-geom.layoutEdges，
 * 与 selftest 共用同一条路径。指向空格的边不画箭头 —— ∅ 表示到此为止。
 */
const edgeShapes = computed(() => layoutEdges(props.cells, props.edges, props.levels))

/** 左 gutter 深度标签：d1..dL，text-anchor:end，y = y(d) + 26 */
const depthLabels = computed(() => Array.from({ length: props.levels }, (_, i) => i + 1))

/** range 横条：矩形算式在 tree-geom.rangeBarRect —— 与 selftest 同一条路径，谁改坏谁红 */
const rangeBar = computed(() => rangeBarRect(props.range, props.levels))

/** 落在格子上的指针标签（画在格子上方）；悬空的收进左下角一行 */
const tags = computed(() => {
  const byCell = new Map()
  for (const p of props.pointers) {
    if (p.at === null) continue
    if (!byCell.has(p.at)) byCell.set(p.at, [])
    byCell.get(p.at).push(p.name)
  }
  const placed = []
  for (const [at, names] of byCell) {
    const pos = posById.value.get(at)
    if (!pos) continue
    const x = slotX(pos.d, pos.k, props.levels) // slotX 语义就是格子中心，直接用
    names.forEach((name, k) => {
      placed.push({ name, x, y: slotY(pos.d) - 8 - k * 16 })
    })
  }
  return placed
})

const floatingPointers = computed(() => props.pointers.filter((p) => p.at === null))

function cellClass(c) {
  const mark = props.marks[c.id]
  // 空格的选中态只换描边（accent + 2px），不改 fill、不改 opacity
  if (c.empty) return mark === 'active' ? ['cell', 'cell--empty', 'cell--empty-active'] : ['cell', 'cell--empty']
  if (mark === 'active') return ['cell', 'cell--active']
  if (mark === 'ok') return ['cell', 'cell--ok']
  return ['cell']
}

function onClickCell(id) {
  if (!clickableGate(props.clickable, id)) return
  emit('node-click', id)
}
</script>

<template>
  <svg
    class="canvas"
    :viewBox="`0 0 ${width} ${height}`"
    :style="{ aspectRatio: `${width} / ${height}`, maxWidth: maxWidth + 'px', '--hotzone': `${hotzonePx}px`, '--edge-w': EDGE_W, '--path-w': PATH_W, '--empty-opacity': EMPTY_OPACITY, '--dash-cell': DASH_CELL, '--dash-edge': DASH_EDGE, '--label-size': `${LABEL_SIZE}px` }"
  >
    <!-- 左 gutter 深度标签：层间带（y(d)..y(d)+44）内不许有任何文字，标签全走格子左侧 -->
    <text v-for="d in depthLabels" :key="`d${d}`" class="depth-label" :x="GUTTER_X" :y="slotY(d) + GUTTER_DY">
      {{ `d${d}` }}
    </text>

    <!-- 边先画、格子后画：入边停在格子上方 6px，出边端口被到达线完整盖住的关系保持简单 -->
    <g v-for="e in edgeShapes" :key="e.key" class="edge" :class="[`edge--${e.kind}`, { 'edge--nullish': e.nullish }]">
      <line class="shaft" :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2" />
      <polygon v-if="e.arrow" class="head" :points="e.arrow" />
    </g>

    <!-- range 横条：与最底行格底净距 4px、与悬空指针行不打架 -->
    <rect
      v-if="rangeBar"
      class="range-bar"
      :x="rangeBar.x1"
      :y="height - 20"
      :width="rangeBar.x2 - rangeBar.x1"
      height="4"
      rx="2"
    />

    <g
      v-for="c in placedCells"
      :key="c.id"
      :class="[...cellClass(c), ...clickable.includes(c.id) ? ['is-clickable'] : []]"
      :style="{ transform: `translate(${c.left}px, ${c.top}px)` }"
      @click="onClickCell(c.id)"
    >
      <rect :width="CELL_W" :height="CELL_H" :rx="CELL_RX" />
      <text v-if="c.empty" class="empty-mark" :x="CELL_W / 2" :y="CELL_H / 2" dy="0.35em" text-anchor="middle">∅</text>
      <text v-else class="value" :x="CELL_W / 2" :y="CELL_H / 2" dy="0.35em" text-anchor="middle">{{ c.value }}</text>
    </g>

    <g v-for="t in tags" :key="t.name" class="tag" :class="`tag--${t.name}`">
      <text :x="t.x" :y="t.y" text-anchor="middle">{{ t.name }}</text>
    </g>

    <!-- 悬空指针：左下角一行（y = height − 8），不指向不存在的地方 -->
    <text v-for="(p, k) in floatingPointers" :key="p.name" class="float-tag" :x="31 + k * 58" :y="height - 8">
      {{ p.name }} = ∅
    </text>
  </svg>
</template>

<style scoped>
.canvas {
  width: 100%;
  margin-inline: auto;
  display: block;
  overflow: visible;
}

.depth-label {
  fill: var(--text-dim);
  font-family: var(--font-mono);
  font-size: var(--label-size);
  text-anchor: end;
  user-select: none;
}

.edge .shaft {
  stroke: var(--cell-line);
  stroke-width: var(--edge-w);
  fill: none;
  stroke-linecap: round;
  transition: stroke 0.3s ease;
}

.edge .head {
  fill: var(--cell-line);
  transition: fill 0.3s ease;
}

/* 路径线：不新画第三条曲线，把栈内格之间的既有斜线改色加粗 */
.edge--path .shaft {
  stroke: var(--accent);
  stroke-width: var(--path-w);
}

.edge--path .head {
  fill: var(--accent);
}

/* 指向空格的边：虚线、无箭头（∅ 表示到此为止） */
.edge--nullish .shaft {
  stroke-dasharray: var(--dash-edge);
}

.edge--nullish .head {
  display: none;
}

.cell {
  cursor: default;
}

.cell > rect {
  fill: var(--cell-bg);
  stroke: var(--cell-line);
  stroke-width: 1.5;
  transition:
    fill 0.3s ease,
    stroke 0.3s ease;
}

.cell > text.value {
  fill: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  user-select: none;
}

/* 空格：与实格同尺寸同坐标，虚线框 fill:none，格内只画一个 ∅ */
.cell--empty > rect {
  fill: none;
  stroke: var(--cell-line);
  stroke-width: 1.5;
  stroke-dasharray: var(--dash-cell);
  opacity: var(--empty-opacity);
}

.cell--empty {
  cursor: default;
}

.cell--empty > text.empty-mark {
  fill: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 13px;
  user-select: none;
}

.cell--empty-active > rect {
  stroke: var(--accent);
  stroke-width: 2;
}

.cell--active > rect {
  fill: var(--cell-mid);
  stroke: var(--cell-mid-line);
  stroke-width: 2;
}

.cell--ok > rect {
  fill: var(--cell-found);
  stroke: var(--cell-found-line);
  stroke-width: 2;
}

.cell.is-clickable {
  cursor: pointer;
}

.cell.is-clickable:hover > rect {
  stroke: var(--accent);
  stroke-width: 2.5;
}

.range-bar {
  fill: var(--accent);
  opacity: 0.25;
}

.tag text {
  fill: var(--accent);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  user-select: none;
}

.float-tag {
  fill: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  user-select: none;
}
</style>

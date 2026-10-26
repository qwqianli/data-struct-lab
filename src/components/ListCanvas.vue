<script setup>
import { computed } from 'vue'

/**
 * 链表渲染器（SVG）。
 *
 * 核心约定：节点的身份是 id，「移动」只体现为 row / col 的变化 ——
 * 同一个 <g> 的 transform 变了，CSS 过渡把它平滑地搬走。
 * row 缺省 0、col 缺省「同 row 内的序号」，所以单行链表（206 / 141）
 * 不传 row / col 时，定位与原来的数组下标定位完全一致，一行代码不用改。
 *
 * links 独立于 nodes：「反转」「合并」的本质都是改 links，节点身份不动。
 */
const props = defineProps({
  nodes: { type: Array, required: true }, // [{ id, value, row?, col? }]
  links: { type: Array, default: () => [] }, // [{ from, to, kind }] to 为 null 表示指向 ∅
  pointers: { type: Array, default: () => [] }, // [{ name, at }] at 为 null 表示悬空
  highlights: { type: Object, default: () => ({}) }, // { [nodeId]: 'ok' | 'active' | 'ghost' }
  clickable: { type: Array, default: () => [] },
  // 画布总行数。多行演示必须传：结果行一开始是空的、节点数会变，
  // 不固定行数的话画布高度会跟着一帧帧长高，节点的移动过渡全被打破
  rows: { type: Number, default: null },
})

const emit = defineEmits(['node-click'])

const NODE_W = 64
const NODE_H = 44
const GAP = 36 // 相邻节点左边距 = NODE_W + GAP = 100
const PAD_X = 40
const TOP = 68 // 节点顶边在其所在行内的 y；行内上方这一段留给该行的指针标签
const DOT_R = 5
const ROW_GAP = 16 // 行间距
const FLOAT_PAD = 26 // 画布最底部留给「prev = ∅」这类浮动文字的空间

const MID_Y = TOP + NODE_H / 2 // 正向箭头在行内的高度，正对 next 域小圆的圆心
const BOT_Y = TOP + NODE_H
const DETOUR_BASE = BOT_Y + 22 // 一行里最浅一条反向边的绕行深度
const DETOUR_STEP = 14 // 反向边逐条加深的步长
const LANE = 10 // 横向错车道：反向边出发段偏右、到达段偏左

function nodeX(col) {
  return PAD_X + col * (NODE_W + GAP)
}

/** 补全缺省 row / col 之后的节点表（顺序与传入的 nodes 一致）。 */
const placedNodes = computed(() => {
  const seqInRow = new Map()
  return props.nodes.map((node) => {
    const row = node.row ?? 0
    const seen = seqInRow.get(row) ?? 0
    seqInRow.set(row, seen + 1)
    return { id: node.id, value: node.value, row, col: node.col ?? seen }
  })
})

const posById = computed(() => new Map(placedNodes.value.map((n) => [n.id, n])))

const countByRow = computed(() => {
  const m = new Map()
  for (const n of placedNodes.value) m.set(n.row, (m.get(n.row) ?? 0) + 1)
  return m
})

const rowCount = computed(() => {
  if (props.rows !== null) return props.rows
  return placedNodes.value.reduce((max, n) => Math.max(max, n.row), 0) + 1
})

/** 「往回指」的边（非 null、同 row、to 在 from 左边）—— 只有它们需要绕行空间。 */
const backCountByRow = computed(() => {
  const m = new Map()
  for (const link of props.links) {
    if (link.to === null) continue
    const from = posById.value.get(link.from)
    const to = posById.value.get(link.to)
    if (from.row === to.row && to.col < from.col) m.set(from.row, (m.get(from.row) ?? 0) + 1)
  }
  return m
})

/**
 * 一行在绕行上要预留的深度。两种口径：
 * 单行画布按「该行节点数 − 1」的上限预留 —— 206 的反向边是逐轮多出来的，
 * 按实际条数算画布会一帧帧变高，节点过渡全被打断，所以必须按上限恒定预留
 * （这也让单行 TOTAL_H 与单行公式 BOT_Y+22+(n−1)×14+26 完全等价）；
 * 多行画布纵向浪费不起，按当前实际的反向边条数紧凑计算。
 */
function detourDepth(row) {
  if (rowCount.value === 1) {
    return 22 + Math.max((countByRow.value.get(row) ?? 0) - 1, 0) * DETOUR_STEP
  }
  const back = backCountByRow.value.get(row) ?? 0
  return back === 0 ? 0 : 22 + back * DETOUR_STEP
}

function rowNeed(row) {
  return TOP + NODE_H + detourDepth(row) + ROW_GAP
}

/** 每行顶部的 y（row 0 恒为 0；行内节点的 y = rowY + TOP）。 */
const rowYs = computed(() => {
  const ys = [0]
  for (let r = 1; r < rowCount.value; r += 1) ys.push(ys[r - 1] + rowNeed(r - 1))
  return ys
})

// 最后一行底下没有行间距，换成浮动文字的预留
const TOTAL_H = computed(() => {
  const last = rowCount.value - 1
  return rowYs.value[last] + TOP + NODE_H + detourDepth(last) + FLOAT_PAD
})

const width = computed(
  () => PAD_X * 2 + props.nodes.length * NODE_W + Math.max(props.nodes.length - 1, 0) * GAP,
)

// 元素越少放大越多，封顶 1.6 倍 —— 否则 3、4 个节点的演示会变成大字报；
// 5 节点（206）544×1.6 已超 860 仍走 860，现有画面不变
const maxWidth = computed(() => Math.min(860, width.value * 1.6))

/**
 * 箭头三角：长 7、半宽 4，尖在终点，朝向由 (dx, dy) 决定。
 * 拆成通用函数是因为三种边的朝向各不相同（朝右 / 朝上 / 沿贝塞尔切线）。
 */
function arrowPoints(tipX, tipY, dx, dy) {
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const baseX = tipX - ux * 7
  const baseY = tipY - uy * 7
  return `${tipX},${tipY} ${baseX + px * 4},${baseY + py * 4} ${baseX - px * 4},${baseY - py * 4}`
}

/**
 * 一条 link 的具体画法，分三种形态：
 * 指向 ∅ 的虚线、正向（相邻直画 / 跳节点拱起）、反向（所在行下方绕行）。
 * 垂直方向一律以「from 节点所在行」为基准 —— 边跟着它的出发点走。
 */
function edgeShape(link) {
  const from = posById.value.get(link.from)
  const base = { key: `${link.from}->${link.to ?? 'null'}`, kind: link.kind }

  if (link.to === null) {
    const startX = nodeX(from.col) + NODE_W - 8 // next 域小圆的右缘
    return {
      ...base,
      type: 'null',
      x1: startX,
      y1: rowYs.value[from.row] + MID_Y,
      x2: startX + 22,
      y2: rowYs.value[from.row] + MID_Y,
      markX: startX + 27,
    }
  }

  const to = posById.value.get(link.to)
  if (to.row !== from.row || to.col > from.col) return forwardShape(base, from, to)
  return backShape(base, from, to)
}

function forwardShape(base, from, to) {
  const rowTop = rowYs.value[from.row]
  const midY = rowTop + MID_Y
  const startX = nodeX(from.col) + NODE_W - 8
  const endX = nodeX(to.col)
  if (to.row === from.row && to.col === from.col + 1) {
    // 相邻直画；线缩短 6px 让三角箭头盖住接缝
    return { ...base, type: 'line', x1: startX, y1: midY, x2: endX - 6, y2: midY, arrow: arrowPoints(endX, midY, 1, 0) }
  }
  // 跨节点 / 跨行：向上拱起的二次贝塞尔。
  // 控制点取 TOP-38 而不是字面的 TOP-18：贝塞尔在 t=0.5 只爬到控制点高度的一半，
  // TOP-18 的拱顶会比节点顶边还低，等于从中间节点身上碾过去。
  const ctrlX = (startX + endX) / 2
  const ctrlY = rowTop + TOP - 38
  return {
    ...base,
    type: 'arc',
    d: `M ${startX} ${midY} Q ${ctrlX} ${ctrlY} ${endX} ${midY}`,
    arrow: arrowPoints(endX, midY, endX - ctrlX, midY - ctrlY),
  }
}

/**
 * 反向边必须走节点下方：上方要留给指针标签，走上面必然叠字。
 * 绕行深度按 from 的 col 错层（单行时 col 就是原下标，206 行为不变）。
 */
function backShape(base, from, to) {
  const rowTop = rowYs.value[from.row]
  const detourY = rowTop + DETOUR_BASE + (from.col - 1) * DETOUR_STEP
  const botY = rowTop + BOT_Y
  // 出发偏右、到达偏左：相邻反向边的竖直段会落在同一条节点中心线上，
  // 同高时出线段会被到达段完整盖住，各让 10px 才分得开
  const fromX = nodeX(from.col) + NODE_W / 2 + LANE
  const toX = nodeX(to.col) + NODE_W / 2 - LANE
  return {
    ...base,
    type: 'arc',
    d: `M ${fromX} ${botY} L ${fromX} ${detourY} L ${toX} ${detourY} L ${toX} ${botY}`,
    arrow: arrowPoints(toX, botY, 0, -1),
  }
}

const edges = computed(() => props.links.map(edgeShape))

/**
 * 指针标签的摆放：落在节点上的画在该节点所在行的上方，第一层行内 +34，
 * 同一节点的第二个指针上第二层 +18，并整组水平错开 26px —— 层和偏移都是为了不叠字。
 */
const tags = computed(() => {
  const namesByNode = new Map()
  for (const p of props.pointers) {
    if (p.at === null) continue
    if (!namesByNode.has(p.at)) namesByNode.set(p.at, [])
    namesByNode.get(p.at).push(p.name)
  }

  const placed = []
  for (const [at, names] of namesByNode) {
    const pos = posById.value.get(at)
    const centerX = nodeX(pos.col) + NODE_W / 2
    const rowTop = rowYs.value[pos.row]
    names.forEach((name, k) => {
      const offset = names.length > 1 ? (k - (names.length - 1) / 2) * 26 : 0
      placed.push({ name, x: centerX + offset, y: rowTop + (k === 0 ? 34 : 18) })
    })
  }
  return placed
})

// 悬空的指针不画箭头指向不存在的地方，收进左下角一列（prev = ∅）
const floatingPointers = computed(() => props.pointers.filter((p) => p.at === null))

function nodeClass(id) {
  const h = props.highlights[id]
  if (h === 'ghost') return 'node node--ghost' // ghost 淡出整个 <g>，active/ok 只换 rect 的填充
  if (h === 'active') return 'node node--active'
  if (h === 'ok') return 'node node--ok'
  return 'node'
}

function onClickNode(id) {
  if (!props.clickable.includes(id)) return
  emit('node-click', id)
}
</script>

<template>
  <svg
    class="canvas"
    :viewBox="`0 0 ${width} ${TOTAL_H}`"
    :style="{ aspectRatio: `${width} / ${TOTAL_H}`, maxWidth: maxWidth + 'px' }"
  >
    <!-- 节点先画、边后画：正向箭头从 next 域小圆里「长出来」，
         比藏在节点背后更能表达「这条边是这个 next 域里的内容」 -->
    <g
      v-for="node in placedNodes"
      :key="node.id"
      :class="[nodeClass(node.id), { 'is-clickable': clickable.includes(node.id) }]"
      :style="{ transform: `translate(${nodeX(node.col)}px, ${rowYs[node.row] + TOP}px)` }"
      @click="onClickNode(node.id)"
    >
      <rect :width="NODE_W" :height="NODE_H" rx="8" />
      <!-- 数据域和 next 域是两块 —— 这条分隔线就是链表节点结构本身，不要简化成纯方块 -->
      <line class="split" :x1="NODE_W - 24" :y1="6" :x2="NODE_W - 24" :y2="NODE_H - 6" />
      <text class="value" :x="30" :y="NODE_H / 2" dy="0.35em" text-anchor="middle">{{ node.value }}</text>
      <circle class="dot" :cx="NODE_W - 13" :cy="NODE_H / 2" :r="DOT_R" />
    </g>

    <g v-for="e in edges" :key="e.key" class="edge" :class="`edge--${e.kind}`">
      <line v-if="e.type === 'line'" class="shaft" :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2" />
      <line v-else-if="e.type === 'null'" class="shaft shaft--dash" :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2" />
      <path v-else class="shaft" :d="e.d" />
      <polygon v-if="e.arrow" class="head" :points="e.arrow" />
      <text v-if="e.type === 'null'" class="null-mark" :x="e.markX" :y="e.y1" dy="0.35em">∅</text>
    </g>

    <g
      v-for="t in tags"
      :key="t.name"
      class="tag"
      :class="`tag--${t.name}`"
      :style="{ transform: `translate(${t.x}px, ${t.y}px)` }"
    >
      <text y="-2" text-anchor="middle">{{ t.name }}</text>
      <path d="M -5 4 L 5 4 L 0 20 Z" />
    </g>

    <!-- 悬空指针横排一行（x = PAD_X/2 + k*58，一个标签约 46 宽、留 12 间隙）：
         竖排时每多一个指针就多占 15px 纵向空间，多行画布的最后一行离底边太近，会压到节点 -->
    <text
      v-for="(p, k) in floatingPointers"
      :key="p.name"
      class="float-tag"
      :x="PAD_X / 2 + k * 58"
      :y="TOTAL_H - 8"
    >
      {{ p.name }} = ∅
    </text>
  </svg>
</template>

<style scoped>
.canvas {
  width: 100%;
  /* 封顶后窄画布不撑满容器：居中，否则整块内容看起来偏左失衡 */
  margin-inline: auto;
  display: block;
  overflow: visible;
}

.node {
  cursor: default;
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.node > rect {
  fill: var(--cell-bg);
  stroke: var(--cell-line);
  stroke-width: 1.5;
  transition:
    fill 0.3s ease,
    stroke 0.3s ease,
    opacity 0.3s ease;
}

.node > text.value {
  fill: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 17px;
  font-weight: 600;
  user-select: none;
}

.node > line.split {
  stroke: var(--cell-line);
  opacity: 0.5;
}

.node > circle.dot {
  fill: var(--cell-line);
  transition: fill 0.3s ease;
}

.node--active > rect {
  fill: var(--cell-mid);
  stroke: var(--cell-mid-line);
  stroke-width: 2;
}

.node--ok > rect {
  fill: var(--cell-found);
  stroke: var(--cell-found-line);
  stroke-width: 2;
}

.node--ghost {
  opacity: 0.25;
}

.node.is-clickable {
  cursor: pointer;
}

.node.is-clickable:hover > rect {
  stroke: var(--accent);
  stroke-width: 2.5;
}

/* stroke 写在 <g> 上由子元素继承：换一种 kind 只需要换一个 class */
.edge--normal {
  stroke: var(--cell-line);
}

.edge--reversed {
  stroke: var(--ok);
}

.edge .shaft {
  fill: none;
  stroke-width: 1.6;
  /* 反向边是 90° 折线，尖角看起来像电路板走线；圆角拐弯才像「指针绕了一下」 */
  stroke-linejoin: round;
  stroke-linecap: round;
  transition: stroke 0.3s ease;
}

.edge--reversed .shaft {
  stroke-width: 2.2;
}

.edge .shaft--dash {
  stroke-dasharray: 4 3;
}

.edge .head {
  transition: fill 0.3s ease;
}

.edge--normal .head {
  fill: var(--cell-line);
}

.edge--reversed .head {
  fill: var(--ok);
}

.edge .null-mark {
  fill: var(--text-dim);
  font-size: 13px;
  stroke: none;
}

.tag {
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.tag text {
  fill: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  user-select: none;
}

.tag path {
  fill: var(--text-dim);
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.tag--prev text,
.tag--prev path {
  fill: var(--accent-2);
}

.tag--cur text,
.tag--cur path {
  fill: var(--warn);
}

.tag--next text,
.tag--next path {
  fill: var(--accent);
}

.tag--slow text,
.tag--slow path {
  fill: var(--accent);
}

.tag--fast text,
.tag--fast path {
  fill: var(--warn);
}

.float-tag {
  fill: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  user-select: none;
}
</style>

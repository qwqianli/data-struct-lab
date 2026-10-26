<script setup>
import { computed } from 'vue'

/**
 * 数组渲染器（SVG）。
 *
 * 为什么用 SVG 而不是 Canvas：这里的每个元素都是「位置会变的对象」，
 * 一个 <g> 对应一个元素、位置走 CSS transform，浏览器自己插值，
 * 比在 Canvas 里手写帧循环少一个数量级的代码。
 *
 * 指针是通用模型：pointers 数组描述「谁、在哪一格、想在哪一层」，
 * 渲染器不认识 low/high/mid 这些具体名字 —— 名字只用来取色（.tag--<name>）。
 * 这样 167 的 left/right、后面单调栈的栈顶指针都能直接复用。
 */
const props = defineProps({
  values: { type: Array, required: true },
  ids: { type: Array, default: null },
  // [{ name, at, row? }]：at 是下标或 null（null = 这个指针现在不存在，不渲染不占层）
  pointers: { type: Array, default: () => [] },
  eliminated: { type: Array, default: () => [] },
  // { [index]: 'active' | 'ok' }：格子本身的着色，一个下标只有一个值
  marks: { type: Object, default: () => ({}) },
  clickable: { type: Boolean, default: false },
})

const emit = defineEmits(['cell-click'])

const CELL_W = 56
const CELL_H = 56
const GAP = 10
const PAD_X = 34
const CELL_Y = 68

const TAG_BASE_Y = 46 // 第 0 层指针标签的 y，每升一层减 16
const TAG_ROW_STEP = 16

const width = computed(() => PAD_X * 2 + props.values.length * CELL_W + (props.values.length - 1) * GAP)
const height = 166

// 元素越少放大越多，但封顶 1.6 倍 —— 否则 3、4 个元素的演示字号会到 50px 以上。
// 10 个元素时 718×1.6 已超 860，仍走 860，二分查找的渲染一个像素都不变
const maxWidth = computed(() => Math.min(860, width.value * 1.6))

const eliminatedSet = computed(() => new Set(props.eliminated))

const items = computed(() => {
  const ids = props.ids ?? props.values.map((_, i) => i)
  return ids.map((id, pos) => ({ id, pos, value: props.values[pos] }))
})

function cellX(pos) {
  return PAD_X + pos * (CELL_W + GAP)
}

function cellClass(item) {
  // 灰化优先于着色：格子被排除后就不该再抢 active/ok 的视觉
  if (eliminatedSet.value.has(item.pos)) return 'cell cell--out'
  if (props.marks[item.pos] === 'active') return 'cell cell--active'
  if (props.marks[item.pos] === 'ok') return 'cell cell--ok'
  return 'cell'
}

function canClick(pos) {
  // 带 marks 的格子是「正在比较 / 已命中」的主角，不是可点的候选；
  // 灰化格子不可点是既有热区约定
  return props.clickable && !eliminatedSet.value.has(pos) && !props.marks[pos]
}

/**
 * 每个指针最终落在哪一层。三个来源合在一起取较大值：
 * ① 显式 row（调用方点名要的高层，如 mid 固定在 low/high 之上）
 * ② 同一下标上的第 k 个指针（按数组顺序数）用第 k 层
 * ③ 水平拥挤避让：两个指针 at 相差 ≤1 又同层时，后出现的升一层
 * 先把整份层数组算完再渲染，规则之间才不打架 —— 和 ListCanvas 的 tags 同一套路。
 */
const placedPointers = computed(() => {
  const pending = []
  const sameAtOrder = new Map()
  for (const p of props.pointers) {
    if (p.at === null) continue
    const k = sameAtOrder.get(p.at) ?? 0
    sameAtOrder.set(p.at, k + 1)
    pending.push({ name: p.name, at: p.at, row: Math.max(p.row ?? 0, k) })
  }

  for (let j = 1; j < pending.length; j += 1) {
    let clashed = true
    while (clashed) {
      clashed = false
      for (let i = 0; i < j; i += 1) {
        const near = Math.abs(pending[i].at - pending[j].at) <= 1
        if (near && pending[i].row === pending[j].row) {
          pending[j].row += 1
          clashed = true // 升到的新层可能又和更早的指针挤上，整趟重查
        }
      }
    }
  }

  return pending.map((p) => ({
    name: p.name,
    x: cellX(p.at) + CELL_W / 2,
    y: TAG_BASE_Y - p.row * TAG_ROW_STEP,
  }))
})

function onClick(pos) {
  if (!canClick(pos)) return
  emit('cell-click', pos)
}
</script>

<template>
  <svg
    class="canvas"
    :viewBox="`0 0 ${width} ${height}`"
    :style="{ aspectRatio: `${width} / ${height}`, maxWidth: maxWidth + 'px' }"
  >
    <!-- 指针标签分三层堆叠（row 0/1/2 → y 46/30/14），避免相邻指针互相遮挡 -->
    <g
      v-for="t in placedPointers"
      :key="t.name"
      class="tag"
      :class="`tag--${t.name}`"
      :style="{ transform: `translate(${t.x}px, ${t.y}px)` }"
    >
      <path d="M -5 2 L 5 2 L 0 9 Z" />
      <text y="0" dy="-3" text-anchor="middle">{{ t.name }}</text>
    </g>

    <g
      v-for="item in items"
      :key="item.id"
      :class="[cellClass(item), { 'is-clickable': canClick(item.pos) }]"
      :style="{ transform: `translate(${cellX(item.pos)}px, ${CELL_Y}px)` }"
      @click="onClick(item.pos)"
    >
      <rect :width="CELL_W" :height="CELL_H" rx="8" />
      <text :x="CELL_W / 2" :y="CELL_H / 2" dy="0.36em" text-anchor="middle">{{ item.value }}</text>
      <text class="idx" :x="CELL_W / 2" :y="CELL_H + 16" text-anchor="middle">{{ item.pos }}</text>
    </g>
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

.cell {
  cursor: default;
}

.cell > rect {
  fill: var(--cell-bg);
  stroke: var(--cell-line);
  stroke-width: 1.5;
  transition:
    fill 0.3s ease,
    stroke 0.3s ease,
    opacity 0.3s ease;
}

.cell > text {
  fill: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 19px;
  font-weight: 600;
  transition: fill 0.3s ease;
  user-select: none;
}

.cell > text.idx {
  fill: var(--text-dim);
  font-size: 11px;
  font-weight: 400;
}

.cell {
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.cell--out > rect {
  opacity: 0.22;
}

.cell--out > text {
  opacity: 0.35;
}

.cell--active > rect {
  fill: var(--cell-mid);
  stroke: var(--cell-mid-line);
  stroke-width: 2;
}

.cell--ok > rect {
  fill: var(--cell-found);
  stroke: var(--cell-found-line);
  stroke-width: 2.5;
}

.cell.is-clickable {
  cursor: pointer;
}

.cell.is-clickable:hover > rect {
  stroke: var(--accent);
  stroke-width: 2.5;
}

.tag path {
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.tag {
  transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.tag text {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  user-select: none;
}

.tag--mid text,
.tag--mid path {
  fill: var(--cell-mid-line);
}

/* left / right 是 167 系列的名字，和 low / high 同族取色：左边蓝、右边紫 */
.tag--low text,
.tag--low path,
.tag--left text,
.tag--left path {
  fill: var(--accent);
}

.tag--high text,
.tag--high path,
.tag--right text,
.tag--right path {
  fill: var(--accent-2);
}
</style>

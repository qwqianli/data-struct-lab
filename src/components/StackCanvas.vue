<script setup>
import { computed } from 'vue'

/**
 * 竖直栈渲染器（SVG）。
 *
 * 为什么栈必须竖着画：「后进先出」只有在「上面压着下面」的视觉里才自解释 ——
 * 横排的栈里，底部和顶部看起来只是「左边的」和「右边的」，谁必须先出去全靠文字说明。
 * 栈底在下、栈顶在上，这个方向是这个组件的全部立意。
 *
 * capacity 是视觉容量（画几个虚线空槽），不是逻辑上限：
 * 元素超过 capacity 时行数按 max 扩、所有槽位一起下移但栈底始终贴底，超出部分照样画。
 */
const props = defineProps({
  items: { type: Array, default: () => [] }, // [{ id, value }]，顺序为底 → 顶
  capacity: { type: Number, default: 6 },
  highlightTop: { type: Boolean, default: true },
})

const ITEM_W = 84
const ITEM_H = 44
const GAP = 8
const PAD_X = 30
const PAD_TOP = 52 // 上方留给「栈顶」标签

const WIDTH = PAD_X * 2 + ITEM_W

// 行数取容量与实际元素的较大者：栈深可以临时超过视觉容量，画布跟着长高而不是丢元素
const rows = computed(() => Math.max(props.capacity, props.items.length))

const HEIGHT = computed(() => PAD_TOP + rows.value * (ITEM_H + GAP) + 24)

/** 槽位 k 的 y：k = 0 是栈底（最下面）。扩行后所有槽位整体下移，栈底永远在最底。 */
function slotY(k) {
  return PAD_TOP + (rows.value - 1 - k) * (ITEM_H + GAP)
}

// 空栈时没有栈顶元素，也不画「栈顶」标签：指向最上方槽位会让第一个元素入栈时
// 标签从画布顶部直接跳到底部，而且暗示「栈从上往下生长」—— 与 slotY(0) 在底部相反
const topLabel = computed(() => {
  if (props.items.length === 0) return null
  return { y: slotY(props.items.length - 1) - 10, text: '栈顶' }
})

// 「空栈」两字竖排在槽位列左侧的中部，把「现在是空的」这个信息接住，不占栈自己的位置
const emptyTag = computed(() => {
  if (props.items.length > 0) return null
  const midY = (slotY(props.capacity - 1) + slotY(0) + ITEM_H) / 2
  return { x: PAD_X - 8, ys: [midY - 8, midY + 8], chars: ['空', '栈'] }
})

const bottomLabelY = computed(() => slotY(0) + ITEM_H + 14)

function itemClass(k) {
  // 只有最上面那个元素是「栈顶」—— 弹出永远从它开始
  return props.highlightTop && k === props.items.length - 1 ? 'item item--top' : 'item'
}
</script>

<template>
  <svg class="canvas" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" :style="{ aspectRatio: `${WIDTH} / ${HEIGHT}` }">
    <!-- 空槽位先画、位置固定：元素出栈后露出来的就是它们，不需要飞出动画 -->
    <rect
      v-for="k in capacity"
      :key="`slot-${k}`"
      class="slot"
      :x="PAD_X"
      :y="slotY(k - 1)"
      :width="ITEM_W"
      :height="ITEM_H"
      rx="8"
    />

    <!-- 外层 g 管定位、内层 g 播入栈动画：keyframes 的 transform 会整体覆盖定位用的
         transform，拆两层才能既保住位置又做出「从上方落进槽位」的效果。
         key 绑 item.id，只有新出现的元素会播，已在栈里的重渲染不重播 -->
    <g
      v-for="(item, k) in items"
      :key="item.id"
      :class="itemClass(k)"
      :style="{ transform: `translate(${PAD_X}px, ${slotY(k)}px)` }"
    >
      <g class="item-inner">
        <rect :width="ITEM_W" :height="ITEM_H" rx="8" />
        <!-- sub 是第二行小字（如单调栈的「#2」下标）。只有带 sub 的元素才把主文字上移，
             不带 sub 时 value 仍在 ITEM_H/2 —— 20 那一关一个像素都不能变 -->
        <text
          class="value"
          :x="ITEM_W / 2"
          :y="item.sub === undefined ? ITEM_H / 2 : ITEM_H / 2 - 7"
          dy="0.35em"
          text-anchor="middle"
        >{{ item.value }}</text>
        <text
          v-if="item.sub !== undefined"
          class="sub"
          :x="ITEM_W / 2"
          :y="ITEM_H / 2 + 10"
          text-anchor="middle"
        >{{ item.sub }}</text>
      </g>
    </g>

    <g v-if="topLabel" class="top-tag" :style="{ transform: `translate(${WIDTH / 2}px, ${topLabel.y}px)` }">
      <text y="0" dy="-2" text-anchor="middle">{{ topLabel.text }}</text>
      <path d="M -5 -2 L 5 -2 L 0 8 Z" />
    </g>

    <template v-if="emptyTag">
      <text
        v-for="(ch, i) in emptyTag.chars"
        :key="`empty-${i}`"
        class="empty-tag"
        :x="emptyTag.x"
        :y="emptyTag.ys[i]"
        text-anchor="end"
      >
        {{ ch }}
      </text>
    </template>

    <text class="bottom-tag" :x="WIDTH / 2" :y="bottomLabelY" text-anchor="middle">栈底</text>
  </svg>
</template>

<style scoped>
.canvas {
  width: 100%;
  max-width: 144px; /* 栈就 144 宽，不放大 */
  margin-inline: auto;
  display: block;
}

.slot {
  fill: none;
  stroke: var(--cell-line);
  /* 0.35 在深色底上只剩几条若有若无的横线，「这个栈能装几个」传不出来；
     0.6 + 更长的划线能让空槽一眼数清，仍明显弱于实心元素 */
  stroke-dasharray: 6 5;
  opacity: 0.6;
}

.item rect {
  fill: var(--cell-bg);
  stroke: var(--cell-line);
  stroke-width: 1.5;
  transition:
    fill 0.3s ease,
    stroke 0.3s ease;
}

.item--top rect {
  fill: var(--cell-mid);
  stroke: var(--cell-mid-line);
  stroke-width: 2;
}

.item text {
  fill: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 600;
  user-select: none;
}

.item text.sub {
  fill: var(--text-dim);
  font-size: 12px;
  font-weight: 400;
}

.item-inner {
  animation: drop 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes drop {
  from {
    transform: translateY(-52px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.top-tag text {
  fill: var(--warn);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  user-select: none;
}

.top-tag path {
  fill: var(--warn);
}

.bottom-tag {
  fill: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  user-select: none;
}

.empty-tag {
  fill: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 12px;
  user-select: none;
}
</style>

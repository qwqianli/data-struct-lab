<script setup>
import { computed } from 'vue'

/**
 * 哈希表渲染器（SVG）：桶数组 + 冲突链。
 *
 * 渲染器里没有任何哈希计算 —— 哈希是引擎的事，画布只收 buckets 现成结果。
 * 三种哈希演示（下标 / 集合 / 计数）的差别只在链节点 value 那行字符串，由 Demo 传进来。
 *
 * 画布高度按 reserveChain 算、不按当前最长链算：链是逐帧变长的，
 * 按实际算画布会一帧帧长高（踩过的坑），从源头堵死。
 */
const props = defineProps({
  capacity: { type: Number, required: true },
  // buckets[b] 是桶 b 的链，链头在前（先存入的在上）；每项 { id, key, value } 全是字符串
  buckets: { type: Array, required: true },
  reserveChain: { type: Number, default: 1 },
  // 正在进行的查询：{ bucket, key, checked, phase }
  // checked = 已确认「不是它」的节点数；phase = scan（正在比对第 checked 个）| hit | miss
  query: { type: Object, default: null },
})

const BUCKET_W = 56
const BUCKET_H = 32
const GAP_X = 10
const PAD = 16
const NODE_W = 56
const NODE_H = 36
const CHAIN_PITCH = 44 // NODE_H 36 + 节点间缝 8

const width = computed(() => PAD * 2 + props.capacity * BUCKET_W + (props.capacity - 1) * GAP_X)
const height = computed(() => 60 + props.reserveChain * CHAIN_PITCH + 12)
// 铁律：viewBox 越窄放大越多（三次同型缺陷），必须封顶
const maxWidth = computed(() => Math.min(860, width.value * 1.6))

function bucketX(b) {
  return PAD + b * (BUCKET_W + GAP_X)
}

function nodeY(k) {
  return 60 + k * CHAIN_PITCH
}

/**
 * 链节点的视觉状态：查询桶之外的 idle；checked 之前的 out（已确认不是它）；
 * 第 checked 个按 phase 染色（scan 蓝 / hit 绿）。
 */
function nodeState(b, k) {
  const q = props.query
  if (!q || q.bucket !== b) return 'idle'
  if (k < q.checked) return 'out'
  if (k === q.checked) return q.phase
  return 'idle'
}
</script>

<template>
  <svg
    class="canvas"
    :viewBox="`0 0 ${width} ${height}`"
    :style="{ aspectRatio: `${width} / ${height}`, maxWidth: maxWidth + 'px' }"
  >
    <g v-for="(chain, b) in buckets" :key="`b-${b}`">
      <!-- 空桶虚线（0.35 在深色底上看不见，踩过的教训）；查询中的桶描琥珀 -->
      <rect
        class="bucket"
        :class="{
          'bucket--filled': chain.length > 0,
          'bucket--query': query !== null && query.bucket === b,
        }"
        :x="bucketX(b)"
        y="16"
        :width="BUCKET_W"
        :height="BUCKET_H"
        rx="7"
      />
      <text class="bucket-no" :x="bucketX(b) + BUCKET_W / 2" y="32" dy="0.35em" text-anchor="middle">{{ b }}</text>

      <template v-for="(item, k) in chain" :key="item.id">
        <!-- 连线：桶底中心 → 首节点顶；节点之间逐段相连 -->
        <line
          class="chain-link"
          :x1="bucketX(b) + BUCKET_W / 2"
          :y1="k === 0 ? 48 : nodeY(k - 1) + NODE_H"
          :x2="bucketX(b) + BUCKET_W / 2"
          :y2="nodeY(k)"
        />
        <g
          class="chain-node"
          :class="`chain-node--${nodeState(b, k)}`"
          :style="{ transform: `translate(${bucketX(b)}px, ${nodeY(k)}px)` }"
        >
          <rect :width="NODE_W" :height="NODE_H" rx="7" />
          <text class="key" :x="NODE_W / 2" y="15" text-anchor="middle">{{ item.key }}</text>
          <text class="value" :x="NODE_W / 2" y="29" text-anchor="middle">{{ item.value }}</text>
        </g>
      </template>
    </g>
  </svg>
</template>

<style scoped>
.canvas {
  width: 100%;
  margin-inline: auto;
  display: block;
  overflow: visible;
}

.bucket {
  fill: var(--cell-bg);
  stroke: var(--cell-line);
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  opacity: 0.6;
  transition:
    stroke 0.3s ease,
    opacity 0.3s ease;
}

.bucket--filled {
  stroke-dasharray: none;
  opacity: 1;
}

/* 查询中的桶：琥珀描边，和 ArrayCanvas marks active 同族色 */
.bucket--query {
  stroke: var(--cell-mid-line);
  stroke-width: 2;
  stroke-dasharray: none;
  opacity: 1;
}

.bucket-no {
  fill: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 13px;
  user-select: none;
}

.chain-link {
  stroke: var(--cell-line);
  stroke-width: 1.5;
}

.chain-node rect {
  fill: var(--cell-bg);
  stroke: var(--cell-line);
  stroke-width: 1.5;
  transition:
    fill 0.3s ease,
    stroke 0.3s ease;
}

.chain-node text.key {
  fill: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 600;
  user-select: none;
  transition: fill 0.3s ease;
}

.chain-node text.value {
  fill: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 11px;
  user-select: none;
}

/* 已确认「不是它」的节点灰化：文字转暗，描边保持底线色 */
.chain-node--out text.key,
.chain-node--out text.value {
  fill: var(--text-dim);
}

/* 正在比对的节点描蓝；命中的节点用「命中绿」（与 ArrayCanvas 的 ok 同 token） */
.chain-node--scan rect {
  stroke: var(--accent);
  stroke-width: 2;
}

.chain-node--hit rect {
  fill: var(--cell-found);
  stroke: var(--cell-found-line);
  stroke-width: 2;
}

/* 只用 transition 做位移动画：keyframes 的 transform 会覆盖定位 transform（踩过的坑） */
.chain-node {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>

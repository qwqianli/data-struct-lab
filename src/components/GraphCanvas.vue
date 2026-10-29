<script setup>
import { computed } from 'vue'
import {
  NODE_R,
  badgeAt,
  edgeGeo,
  graphClickableGate,
  graphHeight,
  graphMaxWidth,
  graphWidth,
  layoutNodes,
  weightAt,
} from '../core/graph-geom.js'

const props = defineProps({
  nodes: { type: Array, required: true },
  edges: { type: Array, required: true },
  marks: { type: Object, default: () => ({}) },
  clickable: { type: Array, default: () => [] },
})

const emit = defineEmits(['node-click'])
const width = computed(() => graphWidth(props.nodes))
const height = computed(() => graphHeight(props.nodes))
const maxWidth = computed(() => graphMaxWidth(props.nodes))
const placedNodes = computed(() => layoutNodes(props.nodes))
const edgeShapes = computed(() => {
  const byId = new Map(placedNodes.value.map((node) => [node.id, node]))
  return props.edges.map((edge) => {
    const geo = edgeGeo(byId.get(edge.from), byId.get(edge.to))
    return { ...edge, geo, weight: edge.w == null ? null : weightAt(geo, edge.at, edge.side) }
  })
})
const badges = computed(() => placedNodes.value
  .filter((node) => node.badge != null || node.peeled === false)
  .map((node) => ({ ...badgeAt(node), id: node.id, text: node.badge ?? node.inDeg })))

function nodeClass(node) {
  const mark = props.marks[node.id]
  if (mark === 'active') return 'node node--active'
  if (mark === 'ok') return 'node node--ok'
  if (mark === 'stuck') return 'node node--stuck'
  return 'node'
}

function onClickNode(id) {
  if (graphClickableGate(props.clickable, id)) emit('node-click', id)
}
</script>

<template>
  <svg
    class="canvas"
    :viewBox="`0 0 ${width} ${height}`"
    :style="{ width: `${maxWidth}px`, maxWidth: '100%', height: 'auto', aspectRatio: `${width} / ${height}` }"
  >
    <g v-for="edge in edgeShapes" :key="edge.id" class="edge">
      <path
        :d="`M ${edge.geo.start[0]} ${edge.geo.start[1]} L ${edge.geo.base[0]} ${edge.geo.base[1]}`"
        class="edge-line"
      />
      <polygon :points="edge.geo.head.map((point) => point.join(',')).join(' ')" class="edge-head" />
      <text v-if="edge.weight" :x="edge.weight[0]" :y="edge.weight[1]" text-anchor="middle" dominant-baseline="central" class="edge-weight">{{ edge.w }}</text>
    </g>

    <g
      v-for="node in placedNodes"
      :key="node.id"
      :class="[nodeClass(node), { 'is-clickable': clickable.includes(node.id) }]"
      @click="onClickNode(node.id)"
    >
      <circle :cx="node.cx" :cy="node.cy" :r="NODE_R" class="node-circle" />
    </g>

    <text
      v-for="node in placedNodes"
      :key="`${node.id}-label`"
      :x="node.cx"
      :y="node.cy"
      text-anchor="middle"
      dominant-baseline="central"
      :class="['node-label', `node-label--${marks[node.id] || 'plain'}`]"
    >{{ node.label }}</text>

    <g v-for="badge in badges" :key="`${badge.id}-badge`" class="badge">
      <circle :cx="badge.cx" :cy="badge.cy" :r="badge.r" />
      <text :x="badge.cx" :y="badge.cy" text-anchor="middle" dominant-baseline="central">{{ badge.text }}</text>
    </g>
  </svg>
</template>

<style scoped>
.canvas {
  display: block;
  overflow: visible;
}

.edge-line {
  fill: none;
  stroke: var(--line);
  stroke-width: 1.5;
}

.edge-head {
  fill: var(--line);
}

.edge-weight { fill: var(--text-dim); font-family: var(--font-mono); font-size: 10px; pointer-events: none; user-select: none; }

.node {
  cursor: default;
}

.node-circle {
  fill: var(--cell-bg);
  stroke: var(--cell-line);
  stroke-width: 1.5;
  transition: fill 0.3s ease, stroke 0.3s ease;
}

.node--ok .node-circle {
  fill: var(--cell-found);
  stroke: var(--cell-found-line);
  stroke-width: 2;
}

.node--active .node-circle {
  fill: var(--cell-mid);
  stroke: var(--cell-mid-line);
  stroke-width: 2;
}

.node--stuck .node-circle {
  fill: var(--cell-bg);
  stroke: var(--danger);
  stroke-width: 2;
  stroke-dasharray: 5 4;
}

.node-label {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
  user-select: none;
}

.node-label--plain,
.node-label--active {
  fill: var(--text-strong);
}

.node-label--ok {
  fill: var(--text-dim);
}

.node-label--stuck {
  fill: var(--text);
}

.badge circle {
  fill: var(--panel-2);
  stroke: var(--line);
  stroke-width: 1;
}

.badge text {
  fill: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 10px;
  pointer-events: none;
  user-select: none;
}

.node.is-clickable {
  cursor: pointer;
}

.node.is-clickable:hover .node-circle {
  stroke: var(--accent);
  stroke-width: 2.5;
}
</style>

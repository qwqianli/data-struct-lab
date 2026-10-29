<script setup>
import { computed } from 'vue'
import {
  CELL,
  CELL_GAP,
  CELL_RX,
  gridClickableGate,
  gridHeight,
  gridMaxWidth,
  gridWidth,
  layoutCells,
} from '../core/grid-geom.js'

const props = defineProps({
  rows: { type: Number, required: true },
  cols: { type: Number, required: true },
  cells: { type: Array, required: true },
  marks: { type: Object, default: () => ({}) },
  clickable: { type: Array, default: () => [] },
})

const emit = defineEmits(['cell-click'])
const placedCells = computed(() => layoutCells(props.cells))
const LABEL_PAD = 14
const canvasWidth = computed(() => gridWidth(props.cols) + LABEL_PAD)
const canvasHeight = computed(() => gridHeight(props.rows) + LABEL_PAD)
const canvasMaxWidth = computed(() => gridMaxWidth(props.cols) + Math.round(LABEL_PAD * 1.6))

function cellClass(cell) {
  if (!cell.land) return 'cell cell--water'
  if (props.marks[cell.id] === 'active') return 'cell cell--active'
  if (props.marks[cell.id] === 'ok') return 'cell cell--ok'
  return 'cell cell--land'
}

function onClickCell(id) {
  if (gridClickableGate(props.clickable, id)) emit('cell-click', id)
}
</script>

<template>
  <svg
    class="canvas"
    :viewBox="`-${LABEL_PAD} -${LABEL_PAD} ${canvasWidth} ${canvasHeight}`"
    :style="{ width: '100%', aspectRatio: `${canvasWidth} / ${canvasHeight}`, maxWidth: `${canvasMaxWidth}px` }"
  >
    <g class="rulers">
      <text v-for="col in cols" :key="`col-${col - 1}`" class="ruler-label" :x="(col - 1) * (CELL + CELL_GAP) + CELL / 2" y="-2" text-anchor="middle">{{ col - 1 }}</text>
      <text v-for="row in rows" :key="`row-${row - 1}`" class="ruler-label" x="-2" :y="(row - 1) * (CELL + CELL_GAP) + CELL / 2" dy="0.35em" text-anchor="end">{{ row - 1 }}</text>
    </g>
    <g
      v-for="cell in placedCells"
      :key="cell.id"
      :class="[cellClass(cell), { 'is-clickable': clickable.includes(cell.id) }]"
      :style="{ transform: `translate(${cell.left}px, ${cell.top}px)` }"
      @click="onClickCell(cell.id)"
    >
      <rect :width="CELL" :height="CELL" :rx="CELL_RX" />
      <text
        v-if="cell.land"
        :class="cell.order === null ? 'order order--pending' : 'order'"
        :x="CELL / 2"
        :y="CELL / 2"
        dy="0.35em"
        text-anchor="middle"
      >{{ cell.order === null ? '·' : cell.order }}</text>
    </g>
  </svg>
</template>

<style scoped>
.canvas {
  display: block;
  margin-inline: auto;
  overflow: visible;
}

.ruler-label {
  fill: var(--text-dim);
  font-size: 11px;
  font-family: var(--font-mono);
  user-select: none;
}

.cell {
  cursor: default;
}

.cell > rect {
  transition: fill 0.3s ease, stroke 0.3s ease;
}

.cell--water > rect {
  fill: var(--panel);
  stroke: var(--line-soft);
  stroke-width: 1;
}

.cell--land > rect {
  fill: var(--cell-bg);
  stroke: var(--cell-line);
  stroke-width: 1.5;
}

.cell--ok > rect {
  fill: var(--cell-found);
  stroke: var(--cell-found-line);
  stroke-width: 2;
}

.cell--active > rect {
  fill: var(--cell-mid);
  stroke: var(--cell-mid-line);
  stroke-width: 2;
}

.order {
  fill: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  user-select: none;
}

.order--pending {
  fill: var(--text-dim);
}

.cell.is-clickable {
  cursor: pointer;
}

.cell.is-clickable:hover > rect {
  stroke: var(--accent);
  stroke-width: 2.5;
}
</style>

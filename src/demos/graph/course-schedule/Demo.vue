<script setup>
import { computed, ref, shallowRef } from 'vue'
import GraphCanvas from '../../../components/GraphCanvas.vue'
import { buildFrames, checkPick, DEFAULT_DATA, FIXTURE_A, FIXTURE_B } from './engine.js'

function resolveData(picks) {
  if (!picks.length) return DEFAULT_DATA
  for (const data of [FIXTURE_A, FIXTURE_B]) {
    if (buildFrames({ data, picks }).at(-1).done) return data
  }
  return DEFAULT_DATA
}

const rawPicks = (new URLSearchParams(window.location.search).get('picks') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const data = shallowRef(resolveData(rawPicks))
defineProps({ related: { type: Array, default: () => [] } })

const picks = ref(rawPicks)
const viewIndex = ref(0)
const feedback = ref('')
const frames = computed(() => buildFrames({ data: data.value, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const waitingAsk = computed(() => frame.value.ask !== null)
const atDecision = computed(() => viewIndex.value === frames.value.length - 1 && frame.value.ask !== null)
const peeledLabels = computed(() => {
  const byId = new Map(frame.value.nodes.map((node) => [node.id, node.label]))
  const labels = frame.value.peeled.map((id) => byId.get(id))
  return labels.length > 8 ? [...labels.slice(0, 4), '…', ...labels.slice(-2)] : labels
})
const cycleLabel = computed(() => {
  if (!frame.value.done) return '—'
  return frame.value.cycle ? '是' : '否'
})

viewIndex.value = frames.value.length - 1

function onPick(pick) {
  if (!atDecision.value) return
  const result = checkPick(frame.value, pick)
  if (!result.ok) {
    feedback.value = result.message
    return
  }
  feedback.value = ''
  const firstNew = frames.value.length
  picks.value.push(pick)
  viewIndex.value = firstNew
}

function advance() {
  if (canAdvance.value) viewIndex.value += 1
}

function undo() {
  if (!picks.value.length) return
  picks.value.pop()
  feedback.value = ''
  viewIndex.value = frames.value.length - 1
}

function reset() {
  picks.value = []
  feedback.value = ''
  viewIndex.value = 0
}

function switchData(next) {
  if (data.value === next) return
  data.value = next
  picks.value = []
  viewIndex.value = 0
  feedback.value = ''
}
</script>

<template>
  <article class="demo">
    <header class="head">
      <div class="head-main">
        <div class="crumb">图 · 拓扑排序</div>
        <h2>课程表 · 拓扑排序 <span class="pill">207 · 中</span></h2>
        <p class="lede">
          每轮剥掉一门入度为 0 的课，它的出边让下游入度 −1；一轮里不止一门入度为 0 时，下标小的先剥。剥不动了就是有环 —— <b>下一步剥哪门由你判断</b>。
        </p>
      </div>
      <a class="external" href="https://leetcode.cn/problems/course-schedule/" target="_blank" rel="noreferrer">
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <div class="modes">
          <button class="mode-btn" :class="{ 'mode-btn--on': data === FIXTURE_A }" @click="switchData(FIXTURE_A)">
            A · 6 门 7 边
          </button>
          <button class="mode-btn" :class="{ 'mode-btn--on': data === FIXTURE_B }" @click="switchData(FIXTURE_B)">
            B · 6 门 6 边（有环）
          </button>
        </div>
        <span class="stage-side">琥珀 = 刚剥下 · 绿 = 已剥 · 红虚线圈 = 卡在环里 · 圆圈左上角小圈里的数字 = 当前入度</span>
      </div>

      <div class="board">
        <div class="graph-col">
          <GraphCanvas :nodes="frame.nodes" :edges="frame.edges" :marks="frame.marks" :clickable="[]" />
        </div>
        <aside class="panel">
          <div class="panel-row peeled-row">
            <span>已剥</span>
            <b>{{ frame.peeled.length }} / {{ frame.nodes.length }}</b>
          </div>
          <div class="panel-row">
            <span>剩余</span>
            <b>{{ frame.remaining.length }}</b>
          </div>
          <div class="panel-row">
            <span>有环</span>
            <b>{{ cycleLabel }}</b>
          </div>
          <div class="stack-row">
            <span>已剥顺序</span>
            <code>{{ peeledLabels.length ? peeledLabels.join(' → ') : '—' }}</code>
          </div>
        </aside>
      </div>
    </section>

    <section class="say" :class="{ 'say--ask': waitingAsk }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint"><span class="caret">▸</span>{{ frame.hint }}</p>
    </section>

    <div v-if="frame.ask" class="ask">
      <p class="ask-prompt">{{ frame.ask.prompt }}</p>
      <div class="ask-options">
        <button v-for="opt in frame.ask.options" :key="opt.pick" class="ask-btn" @click="onPick(opt.pick)">
          {{ opt.label }}
        </button>
      </div>
    </div>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.done" class="verdict" :class="frame.cycle ? 'verdict--warn' : 'verdict--ok'">
      {{ frame.cycle ? '剥不动了 —— 有环，207 的答案是 false。' : '全部剥完 —— 没有环，207 的答案是 true。' }}
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>f{{ viewIndex }}</b> / f{{ frames.length - 1 }}</span>
        <span class="dot">·</span>
        <span>已剥 <b>{{ frame.peeled.length }}</b></span>
        <span class="dot">·</span>
        <span>剩余 <b>{{ frame.remaining.length }}</b></span>
        <span class="dot">·</span>
        <span>有环 <b>{{ cycleLabel }}</b></span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关练拓扑排序和环检测。下面四题分别延续剥点、最短路和图遍历。</p>
      <ul class="rel-list">
        <li v-for="r in related" :key="r.no" class="rel">
          <a class="rel-link" :href="`https://leetcode.cn/problems/${r.slug}/`" target="_blank" rel="noreferrer">
            <span class="rel-no">{{ r.no }}</span>
            <span class="rel-title">{{ r.title }}</span>
            <span class="rel-diff" :class="`rel-diff--${r.difficulty}`">{{ r.difficulty }}</span>
          </a>
          <p class="rel-why">{{ r.why }}</p>
        </li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
.demo { max-width: 940px; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
.crumb { font-size: 12px; color: var(--text-dim); letter-spacing: 0.4px; margin-bottom: 6px; }
h2 { margin: 0 0 8px; font-size: 21px; font-weight: 650; color: var(--text-strong); letter-spacing: 0.2px; }
.pill { display: inline-block; vertical-align: middle; margin-left: 6px; font-size: 11px; font-weight: 600; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--line); color: var(--text-dim); }
.lede { margin: 0; color: var(--text); font-size: 13.5px; max-width: 640px; }
.lede b { color: var(--text-strong); font-weight: 600; }
.external { flex: none; font-size: 12.5px; color: var(--accent); text-decoration: none; border: 1px solid var(--line); border-radius: 7px; padding: 6px 13px; white-space: nowrap; }
.stage { background: linear-gradient(180deg, #101825 0%, #0e1520 100%); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px 14px; margin-bottom: 14px; }
.stage-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.modes { display: flex; gap: 8px; flex-wrap: wrap; }
.mode-btn { font-size: 12px; padding: 5px 11px; border-radius: 7px; border: 1px solid var(--line); background: transparent; color: var(--text-dim); cursor: pointer; }
.mode-btn--on { color: var(--text-strong); border-color: #35557f; background: #12203a; }
.stage-side { font-size: 11.5px; color: var(--text-dim); }
.board { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; align-items: flex-start; }
.graph-col { flex: none; max-width: 100%; }
.panel { flex: none; width: 220px; display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
.panel-row { display: flex; align-items: baseline; justify-content: space-between; padding: 7px 10px; border: 1px solid var(--line-soft); border-radius: 8px; background: var(--panel); color: var(--text-dim); font-size: 12px; }
.panel-row b { color: var(--text-strong); font-family: var(--font-mono); font-size: 14px; }
.peeled-row b { color: var(--accent); font-size: 24px; line-height: 1.1; }
.stack-row { min-height: 68px; padding: 8px 10px; border: 1px solid var(--line-soft); border-radius: 8px; background: var(--panel); color: var(--text-dim); font-size: 12px; }
.stack-row code { display: block; margin-top: 7px; color: var(--text-strong); font: 11px/1.7 var(--font-mono); overflow-wrap: anywhere; }
.say { border-left: 3px solid var(--accent); padding: 2px 0 2px 14px; margin-bottom: 14px; }
.say--ask { border-left-color: #e3c07a; }
.say-text { margin: 0 0 5px; color: var(--text-strong); font-size: 13.5px; }
.say-hint { margin: 0; color: var(--text-dim); font-size: 12.5px; }
.caret { color: var(--accent); margin-right: 6px; }
.ask { margin-bottom: 14px; padding: 12px 15px; border: 1px solid #27405e; border-radius: 9px; background: #12203a; }
.ask-prompt { margin: 0 0 10px; font-size: 13.5px; font-weight: 600; color: var(--text-strong); }
.ask-options { display: flex; flex-wrap: wrap; gap: 9px; }
.ask-btn { flex: 1 1 120px; text-align: left; padding: 9px 14px; }
.feedback { margin: 0 0 14px; padding: 10px 14px; border-radius: 8px; background: #2a1810; border: 1px solid #5c3620; color: #ffc48a; font-size: 13px; }
.verdict { margin-bottom: 14px; padding: 11px 15px; border-radius: 9px; font-size: 13px; line-height: 1.7; }
.verdict--ok { background: #0f2519; border: 1px solid #1f5138; color: #a8e3c1; }
.verdict--warn { background: #2a1810; border: 1px solid #5c3620; color: #ffc48a; }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-top: 1px solid var(--line-soft); }
.stats { font-size: 12.5px; color: var(--text-dim); font-family: var(--font-mono); }
.stats b { color: var(--text-strong); font-weight: 600; }
.dot { margin: 0 8px; opacity: 0.5; }
.actions { display: flex; gap: 9px; }
.next { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line-soft); }
.next h3 { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--text-strong); }
.next-note { margin: 0 0 14px; font-size: 12.5px; color: var(--text-dim); }
.rel-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; }
.rel { background: var(--panel); border: 1px solid var(--line-soft); border-radius: 9px; padding: 10px 14px; }
.rel-link { display: flex; align-items: baseline; gap: 10px; text-decoration: none; }
.rel-no { font-family: var(--font-mono); font-size: 12px; color: var(--accent); min-width: 34px; }
.rel-title { color: var(--text-strong); font-size: 13.5px; font-weight: 550; }
.rel-diff { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--text-dim); }
.rel-diff--易 { color: #7fd6a8; border-color: #24513c; }
.rel-diff--中 { color: #e3c07a; border-color: #574526; }
.rel-diff--难 { color: #e8a9a9; border-color: #5c2828; }
.rel-why { margin: 5px 0 0 44px; font-size: 12.5px; color: var(--text-dim); line-height: 1.6; }

@media (max-width: 600px) {
  .head { flex-direction: column; gap: 12px; }
  .stage { padding-inline: 12px; }
  .stage-row { align-items: flex-start; flex-direction: column; }
  .board { flex-direction: column; align-items: center; }
  .graph-col { max-width: 100%; }
  .panel { width: min(220px, 100%); }
  .bar { align-items: flex-start; flex-direction: column; }
}
</style>

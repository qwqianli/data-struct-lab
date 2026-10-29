<script setup>
import { computed, ref } from 'vue'
import GridCanvas from '../../../components/GridCanvas.vue'
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

const data = ref(resolveData(rawPicks))
defineProps({ related: { type: Array, default: () => [] } })

const picks = ref(rawPicks)
const viewIndex = ref(0)
const feedback = ref('')
const frames = computed(() => buildFrames({ data: data.value, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const waitingAsk = computed(() => frame.value.ask !== null)
const atDecision = computed(() => viewIndex.value === frames.value.length - 1 && frame.value.ask !== null)
const totalLand = computed(() => data.value.grid.flat().filter((value) => value === 1).length)
const stackLabels = computed(() => {
  const byId = new Map(frame.value.cells.map((cell) => [cell.id, cell]))
  const labels = frame.value.stack.map((id) => {
    const cell = byId.get(id)
    return `(${cell.r},${cell.c})`
  })
  return labels.length > 8 ? [...labels.slice(0, 4), '…', ...labels.slice(-2)] : labels
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
        <div class="crumb">图 · 网格 DFS</div>
        <h2>岛屿数量 · DFS <span class="pill">200 · 中</span></h2>
        <p class="lede">
          从一块陆地出发，按<b>上 → 右 → 下 → 左</b>深搜；栈空后再找下一块没访问的陆地。<b>下一步往哪走由你判断</b>，回溯和换岛自动完成。
        </p>
      </div>
      <a class="external" href="https://leetcode.cn/problems/number-of-islands/" target="_blank" rel="noreferrer">
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <div class="modes">
          <button class="mode-btn" :class="{ 'mode-btn--on': data === FIXTURE_A }" @click="switchData(FIXTURE_A)">
            A · 4×5
          </button>
          <button class="mode-btn" :class="{ 'mode-btn--on': data === FIXTURE_B }" @click="switchData(FIXTURE_B)">
            B · 5×5
          </button>
        </div>
        <span class="stage-side">琥珀 = 当前站的位置 · 绿 = 已访问（格内数字是访问序号）</span>
      </div>

      <div class="board">
        <div class="grid-col">
          <GridCanvas :rows="frame.rows" :cols="frame.cols" :cells="frame.cells" :marks="frame.marks" :clickable="[]" />
        </div>
        <aside class="panel">
          <div class="panel-row island-row">
            <span>岛数</span>
            <b>{{ frame.count }}</b>
          </div>
          <div class="panel-row">
            <span>栈深</span>
            <b>{{ frame.stack.length }}</b>
          </div>
          <div class="panel-row">
            <span>已访问</span>
            <b>{{ frame.visited }} / {{ totalLand }}</b>
          </div>
          <div class="stack-row">
            <span>栈（底 → 顶）</span>
            <code>{{ stackLabels.length ? stackLabels.join(' → ') : '空' }}</code>
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

    <div v-if="frame.done" class="verdict verdict--ok">
      <b>全部扫完。</b>共发现 <b>{{ frame.count }} 个岛</b>，访问了 {{ frame.visited }} 块陆地；每个岛都在栈空后才开始计数。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>f{{ viewIndex }}</b> / f{{ frames.length - 1 }}</span>
        <span class="dot">·</span>
        <span>栈深 <b>{{ frame.stack.length }}</b></span>
        <span class="dot">·</span>
        <span>岛数 <b>{{ frame.count }}</b></span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关练四邻 DFS 与回溯。下面四题沿着网格搜索继续深入。</p>
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
.grid-col { flex: none; }
.panel { flex: none; width: 220px; display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
.panel-row { display: flex; align-items: baseline; justify-content: space-between; padding: 7px 10px; border: 1px solid var(--line-soft); border-radius: 8px; background: var(--panel); color: var(--text-dim); font-size: 12px; }
.panel-row b { color: var(--text-strong); font-family: var(--font-mono); font-size: 14px; }
.island-row b { color: var(--accent); font-size: 24px; line-height: 1.1; }
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
.ask-btn { flex: 1 1 150px; text-align: left; padding: 9px 14px; }
.feedback { margin: 0 0 14px; padding: 10px 14px; border-radius: 8px; background: #2a1810; border: 1px solid #5c3620; color: #ffc48a; font-size: 13px; }
.verdict { margin-bottom: 14px; padding: 11px 15px; border-radius: 9px; font-size: 13px; line-height: 1.7; }
.verdict--ok { background: #0f2519; border: 1px solid #1f5138; color: #a8e3c1; }
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
  .grid-col { max-width: 100%; }
  .panel { width: min(220px, 100%); }
  .bar { align-items: flex-start; flex-direction: column; }
}
</style>

<script setup>
import { computed, ref } from 'vue'
import ListCanvas from '../../../components/ListCanvas.vue'
import { buildFrames, checkPick, DEFAULT_POS, DEFAULT_VALUES, NO_CYCLE_POS, OUT } from './engine.js'

/**
 * 交互模型沿用 206 的双状态：picks 是唯一进 URL 的进度状态，
 * viewIndex 只管「当前看到第几帧」。每轮答对后自动补 3 帧，逐帧看。
 * 差别在决策方式：这里不是选按钮，而是**点画布里的节点**预测 fast 的落点。
 */
const values = DEFAULT_VALUES
const pos = ref(DEFAULT_POS)

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
defineProps({
  related: { type: Array, default: () => [] },
})

// pick 是节点 id（如 n2）或 OUT；非法值交给 buildFrames 静默跳过
const picks = ref(
  (new URLSearchParams(window.location.search).get('picks') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const viewIndex = ref(0)
const feedback = ref('')

const frames = computed(() => buildFrames({ values, pos: pos.value, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const waitingAsk = computed(() => frame.value.ask !== null)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)

// 只在决策帧放开点击；平时节点不可点，避免误触改变进度
const clickableIds = computed(() => (waitingAsk.value ? frame.value.nodes.map((n) => n.id) : []))

// 从 URL 恢复进度时直接落在最新一帧：分享链接第一眼就是当前状态（同 206）
viewIndex.value = frames.value.length - 1

/** 指针落在哪个值上（悬空显示 ∅），底部状态栏用。 */
function posOf(name) {
  const p = frame.value.pointers.find((x) => x.name === name)
  if (!p || p.at === null) return '∅'
  return frame.value.nodes.find((n) => n.id === p.at).value
}

function onPick(pick) {
  const result = checkPick(frame.value, pick)
  if (!result.ok) {
    feedback.value = result.message
    return
  }
  feedback.value = ''
  const firstNew = frames.value.length // 新增的 3 帧从「当前提问帧 + 1」开始
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

/**
 * 有环 / 无环的对照是这个演示一半的价值，必须能一键切换。
 * picks 是跟着旧链表走的进度，换了世界就必须清空重来。
 */
function switchPos(next) {
  if (pos.value === next) return
  pos.value = next
  picks.value = []
  viewIndex.value = 0
  feedback.value = ''
}
</script>

<template>
  <article class="demo">
    <header class="head">
      <div class="head-main">
        <div class="crumb">链表 · 判环</div>
        <h2>环形链表 · 快慢指针 <span class="pill pill--easy">141 · 易</span></h2>
        <p class="lede">
          判断链表有没有环。fast 每轮走 2 步、slow 走 1 步 ——
          <b>fast 每一轮的落点由你来点</b>，点错会告诉你它实际走到哪。
        </p>
      </div>
      <a class="external" href="https://leetcode.cn/problems/linked-list-cycle/" target="_blank" rel="noreferrer">
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <div class="modes">
          <button
            class="mode-btn"
            :class="{ 'mode-btn--on': pos === DEFAULT_POS }"
            @click="switchPos(DEFAULT_POS)"
          >
            有环（pos=1）
          </button>
          <button
            class="mode-btn"
            :class="{ 'mode-btn--on': pos === NO_CYCLE_POS }"
            @click="switchPos(NO_CYCLE_POS)"
          >
            无环（pos=-1）
          </button>
        </div>
        <span class="stage-side">节点不动；尾巴连回去的那条边会从下方绕行</span>
      </div>
      <ListCanvas
        :nodes="frame.nodes"
        :links="frame.links"
        :pointers="frame.pointers"
        :highlights="frame.highlights"
        :clickable="clickableIds"
        @node-click="onPick"
      />
    </section>

    <section class="say" :class="{ 'say--ask': waitingAsk }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint">
        <span class="caret">▸</span>{{ frame.hint }}
      </p>
    </section>

    <div v-if="frame.ask" class="ask">
      <div class="ask-row">
        <p class="ask-prompt">{{ frame.ask.prompt }}</p>
        <button class="ask-out" @click="onPick(OUT)">fast 走出链表（空）</button>
      </div>
      <p class="ask-note">在画布里点你预测的节点；只有 fast 会踩空时才点右边的按钮。</p>
    </div>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.done && frame.met" class="verdict verdict--ok">
      <b>有环。</b>第 {{ frame.round }} 轮相遇 —— fast 每轮净追 1 步，在环里差距只减不增，迟早归零。
    </div>
    <div v-else-if="frame.done" class="verdict verdict--out">
      <b>没有环。</b>fast 比 slow 跑得快、还先走出了链表 —— 如果有环，它永远出不去。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>已走 <b>{{ frame.round }}</b> 轮</span>
        <span class="dot">·</span>
        <span>slow <b>{{ posOf('slow') }}</b></span>
        <span class="dot">·</span>
        <span>fast <b>{{ posOf('fast') }}</b></span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关只练「快慢指针会不会相遇」。下面四题各多考一个东西，按顺序做。</p>
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
.demo {
  max-width: 940px;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;
}

.crumb {
  font-size: 12px;
  color: var(--text-dim);
  letter-spacing: 0.4px;
  margin-bottom: 6px;
}

h2 {
  margin: 0 0 8px;
  font-size: 21px;
  font-weight: 650;
  color: var(--text-strong);
  letter-spacing: 0.2px;
}

.pill {
  display: inline-block;
  vertical-align: middle;
  margin-left: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text-dim);
}

.pill--easy {
  color: #7fd6a8;
  border-color: #24513c;
  background: #10241a;
}

.lede {
  margin: 0;
  color: var(--text);
  font-size: 13.5px;
  max-width: 640px;
}

.lede b {
  color: var(--text-strong);
  font-weight: 600;
}

.external {
  flex: none;
  font-size: 12.5px;
  color: var(--accent);
  text-decoration: none;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 6px 13px;
  white-space: nowrap;
  transition: border-color 0.18s ease;
}

.external:hover {
  border-color: #35557f;
}

.stage {
  background: linear-gradient(180deg, #101825 0%, #0e1520 100%);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px 20px 10px;
  margin-bottom: 16px;
}

.stage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.modes {
  display: flex;
  gap: 8px;
}

.mode-btn {
  font-size: 12.5px;
  padding: 5px 12px;
}

/* 当前那组数据要一眼认出，但不抢决策按钮的视觉焦点 */
.mode-btn--on {
  background: #1b3b66;
  border-color: #2f5f9e;
  color: var(--text-strong);
}

.stage-side {
  font-size: 11.5px;
  color: var(--text-dim);
}

.say {
  border-left: 3px solid var(--line);
  padding: 2px 0 2px 14px;
  margin-bottom: 14px;
}

.say--ask {
  border-left-color: var(--accent);
}

.say-text {
  margin: 0 0 5px;
  color: var(--text-strong);
  font-size: 13.5px;
}

.say-hint {
  margin: 0;
  color: var(--text-dim);
  font-size: 12.5px;
}

.caret {
  color: var(--accent);
  margin-right: 6px;
}

.ask {
  margin-bottom: 14px;
  padding: 12px 15px;
  border: 1px solid #27405e;
  border-radius: 9px;
  background: #12203a;
}

.ask-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ask-prompt {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-strong);
}

/* 「走出链表」是一个答案而不是操作：给它接近节点的中性色，不做成主按钮 */
.ask-out {
  font-size: 12.5px;
  padding: 6px 12px;
  border-color: #574526;
  color: #e3c07a;
}

.ask-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-dim);
}

.feedback {
  margin: 0 0 14px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #2a1810;
  border: 1px solid #5c3620;
  color: #ffc48a;
  font-size: 13px;
  animation: pop 0.18s ease;
}

@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.verdict {
  margin-bottom: 14px;
  padding: 11px 15px;
  border-radius: 9px;
  font-size: 13px;
  line-height: 1.7;
}

.verdict--ok {
  background: #0f2519;
  border: 1px solid #1f5138;
  color: #a8e3c1;
}

/* 「无环」是正确结论而不是错误，用蓝系而不是红系 */
.verdict--out {
  background: #0e2233;
  border: 1px solid #23507c;
  color: #a9ccec;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--line-soft);
}

.stats {
  font-size: 12.5px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.stats b {
  color: var(--text-strong);
  font-weight: 600;
}

.dot {
  margin: 0 8px;
  opacity: 0.5;
}

.actions {
  display: flex;
  gap: 9px;
}

.next {
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--line-soft);
}

.next h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-strong);
}

.next-note {
  margin: 0 0 14px;
  font-size: 12.5px;
  color: var(--text-dim);
}

.rel-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 9px;
}

.rel {
  background: var(--panel);
  border: 1px solid var(--line-soft);
  border-radius: 9px;
  padding: 10px 14px;
  transition: border-color 0.18s ease;
}

.rel:hover {
  border-color: #2e4054;
}

.rel-link {
  display: flex;
  align-items: baseline;
  gap: 10px;
  text-decoration: none;
}

.rel-no {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  min-width: 34px;
}

.rel-title {
  color: var(--text-strong);
  font-size: 13.5px;
  font-weight: 550;
}

.rel-diff {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text-dim);
}

.rel-diff--易 {
  color: #7fd6a8;
  border-color: #24513c;
}

.rel-diff--中 {
  color: #e3c07a;
  border-color: #574526;
}

.rel-diff--难 {
  color: #e79b96;
  border-color: #57352f;
}

.rel-why {
  margin: 5px 0 0 44px;
  font-size: 12.5px;
  color: var(--text-dim);
  line-height: 1.6;
}
</style>

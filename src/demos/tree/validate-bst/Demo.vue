<script setup>
import { computed, ref } from 'vue'
import TreeCanvas from '../../../components/TreeCanvas.vue'
import ArrayCanvas from '../../../components/ArrayCanvas.vue'
import { buildFrames, checkPick, DEFAULT_NUMS, FIXTURE_A, FIXTURE_B, FIXTURE_C } from './engine.js'

/**
 * 双状态模型（同前三题）：picks 是唯一进度状态（进 URL），viewIndex 只管看到第几帧。
 * 混合词汇：点格子（中序访问，含空格）+ 边界决策（收紧 / 不收紧）。
 * range 横条是本题主视觉：两端 = 设定上下界的祖先格，没有约束的一侧铺到全树边缘。
 *
 * 数据集不进 URL，三组按全序列复放判定（哪组把整份 picks 吃到 done 就落哪组，都不中回落 A）。
 */
function resolveNums(picks) {
  if (!picks.length) return DEFAULT_NUMS
  for (const nums of [FIXTURE_A, FIXTURE_B, FIXTURE_C]) {
    if (buildFrames({ nums, picks }).at(-1).done) return nums
  }
  return DEFAULT_NUMS
}

const rawPicks = (new URLSearchParams(window.location.search).get('picks') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const nums = ref(resolveNums(rawPicks))

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
defineProps({
  related: { type: Array, default: () => [] },
})

const picks = ref(rawPicks)
const viewIndex = ref(0)
const feedback = ref('')

const frames = computed(() => buildFrames({ nums: nums.value, picks: picks.value }))
const frame = computed(() => frames.value[Math.min(viewIndex.value, frames.value.length - 1)])
const canAdvance = computed(() => viewIndex.value < frames.value.length - 1)
const waitingAsk = computed(() => frame.value.ask !== null)
const frameNo = computed(() => Math.min(viewIndex.value, frames.value.length - 1) + 1)
const realCount = computed(() => frames.value[0].cells.filter((c) => !c.empty).length)
const violationCount = computed(() => frames.value[0].cells.filter((c) => !c.empty && frame.value.marks[c.id] === 'active').length)

// 决策只发生在最后一帧：格子决策（clickable 非空）或边界决策（ask 在场）
const atDecision = computed(
  () => viewIndex.value === frames.value.length - 1 && (frame.value.clickable.length > 0 || frame.value.ask !== null),
)

// 中序序列：最新追加的一格按判定着色（合法 = ok，越界 = active 保持琥珀）
const seqMarks = computed(() => {
  if (frame.value.seqMark === null || frame.value.seqMark === undefined) return {}
  const lastId = frame.value.judgedIds[frame.value.judgedIds.length - 1]
  return { [frame.value.seqMark]: frame.value.marks[lastId] ?? 'ok' }
})

// 从 URL 恢复进度时直接落在最新一帧：分享出去的链接第一眼就是当前状态（同前三题）
viewIndex.value = frames.value.length - 1

function onPick(pick) {
  if (!atDecision.value) return
  const result = checkPick(frame.value, pick)
  if (!result.ok) {
    feedback.value = result.message
    return
  }
  feedback.value = ''
  const firstNew = frames.value.length // 新帧从「当前决策帧 + 1」开始
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

/** 三组各考一件事：A 递增合法；B 父子比较就够（下界违规）；C 必须传界（上界违规）。切换即清空进度。 */
function switchData(next) {
  if (nums.value === next) return
  nums.value = next
  picks.value = []
  viewIndex.value = 0
  feedback.value = ''
}
</script>

<template>
  <article class="demo">
    <header class="head">
      <div class="head-main">
        <div class="crumb">二叉树 · 验证 BST</div>
        <h2>验证二叉搜索树 <span class="pill pill--mid">98 · 中</span></h2>
        <p class="lede">
          只比父子是不够的。<b>每个节点的合法区间由祖先传下来</b>：进入前你先决策「要不要收紧」，
          底部横条就是这段区间 —— 越过它任何一个边界，中序就不再递增。
        </p>
      </div>
      <a
        class="external"
        href="https://leetcode.cn/problems/validate-binary-search-tree/"
        target="_blank"
        rel="noreferrer"
      >
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <div class="modes">
          <button class="mode-btn" :class="{ 'mode-btn--on': nums === FIXTURE_A }" @click="switchData(FIXTURE_A)">
            合法&nbsp;&nbsp;[2,1,3]
          </button>
          <button class="mode-btn" :class="{ 'mode-btn--on': nums === FIXTURE_B }" @click="switchData(FIXTURE_B)">
            父子就够&nbsp;&nbsp;[5,1,4,null,null,3,6]
          </button>
          <button class="mode-btn" :class="{ 'mode-btn--on': nums === FIXTURE_C }" @click="switchData(FIXTURE_C)">
            必须传界&nbsp;&nbsp;[5,4,null,3,7]
          </button>
        </div>
        <span class="stage-side">琥珀 = 越界 · 绿 = 已判合法 · 底部横条 = 合法区间</span>
      </div>

      <TreeCanvas
        :cells="frame.cells"
        :edges="frame.edges"
        :pointers="frame.pointers"
        :marks="frame.marks"
        :clickable="atDecision ? frame.clickable : []"
        :levels="frame.levels"
        :range="frame.range"
        @node-click="onPick"
      />
    </section>

    <section class="seq-block">
      <span class="row-label">中序序列</span>
      <ArrayCanvas :values="frame.seq" :marks="seqMarks" />
    </section>

    <section class="say" :class="{ 'say--ask': waitingAsk }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint">
        <span class="caret">▸</span>{{ frame.hint }}
      </p>
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

    <div v-if="frame.done && frame.answer !== null" class="verdict" :class="frame.answer ? 'verdict--ok' : 'verdict--bad'">
      <b>{{ frame.answer ? '是合法 BST。' : '不是 BST。' }}</b>中序序列
      [{{ frame.seq.join('、') }}]{{ frame.answer ? '严格递增 —— 每个节点都落在祖先传下来的区间内。' : ' 不递增 —— 越界的格子在树上保持琥珀色，横条标出了它本该守住的区间。' }}
    </div>

    <footer class="bar">
      <div class="stats">
        <span>帧 <b>{{ frameNo }}</b> / {{ frames.length }}</span>
        <span class="dot">·</span>
        <span>已判定 <b>{{ frame.judgedIds.length }}</b> / {{ realCount }}</span>
        <span class="dot">·</span>
        <span>越界 <b>{{ violationCount }}</b></span>
        <span class="dot">·</span>
        <span>点格子进入，进入前先答边界决策</span>
      </div>
      <div class="actions">
        <button class="primary" :disabled="!canAdvance" @click="advance">继续</button>
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关练「沿路传一个随路径变化的判据」。下面四题各多考一个东西，按顺序做。</p>
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

.pill--mid {
  color: #e3c07a;
  border-color: #574526;
  background: #241d0e;
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
  padding: 18px 20px 14px;
  margin-bottom: 14px;
}

.stage-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.modes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mode-btn {
  font-size: 12px;
  padding: 5px 11px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  transition:
    color 0.18s ease,
    border-color 0.18s ease;
}

.mode-btn--on {
  color: var(--text-strong);
  border-color: #35557f;
  background: #12203a;
}

.stage-side {
  font-size: 11.5px;
  color: var(--text-dim);
}

.seq-block {
  background: var(--panel);
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  padding: 12px 20px 16px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.seq-block .row-label {
  flex: none;
}

.row-label {
  font-size: 11.5px;
  color: var(--text-dim);
  letter-spacing: 0.4px;
}

.say {
  border-left: 3px solid var(--accent);
  padding: 2px 0 2px 14px;
  margin-bottom: 14px;
}

.say--ask {
  border-left-color: #e3c07a;
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

.ask-prompt {
  margin: 0 0 10px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-strong);
}

.ask-options {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.ask-btn {
  flex: 1 1 200px;
  text-align: left;
  padding: 9px 14px;
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

.verdict--bad {
  background: #2a1414;
  border: 1px solid #5c2828;
  color: #e8a9a9;
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

.rel-why {
  margin: 5px 0 0 44px;
  font-size: 12.5px;
  color: var(--text-dim);
  line-height: 1.6;
}
</style>

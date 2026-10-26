<script setup>
import { computed, ref } from 'vue'
import ListCanvas from '../../../components/ListCanvas.vue'
import { buildFrames, checkPick, LIST_A, LIST_B } from './engine.js'

/**
 * 交互模型沿用二分查找的单帧结构：每次决策产 1 帧，picks 一变直接显示最后一帧。
 * 决策方式是点画布里的节点 —— 两个链表当前的头就是候选。
 */
const listA = LIST_A
const listB = LIST_B

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
defineProps({
  related: { type: Array, default: () => [] },
})

// picks 是节点 id 序列，?picks=a0,b0,a1 可复现任意一次练习
const picks = ref(
  (new URLSearchParams(window.location.search).get('picks') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const feedback = ref('')

const frames = computed(() => buildFrames({ listA, listB, picks: picks.value }))
const frame = computed(() => frames.value[frames.value.length - 1])
const playing = computed(() => !frame.value.done)

// 只有两条链都还有头，才存在「取谁」的决策；走空的一方由引擎自动接上
const clickableIds = computed(() => {
  const f = frame.value
  if (f.done) return []
  const ids = []
  for (const name of ['l1', 'l2']) {
    const at = f.pointers.find((p) => p.name === name).at
    if (at !== null) ids.push(at)
  }
  return ids
})

/** 某个指针当前落在哪个值上（悬空显示 ∅），状态栏用。 */
function headOf(name) {
  const p = frame.value.pointers.find((x) => x.name === name)
  if (!p || p.at === null) return '∅'
  return frame.value.nodes.find((n) => n.id === p.at).value
}

// 完成后按 col 排出结果链的完整序列
const mergedLine = computed(() => {
  const f = frame.value
  if (!f.done) return ''
  return f.nodes
    .filter((n) => n.row === 2)
    .sort((a, b) => a.col - b.col)
    .map((n) => n.value)
    .join(' → ')
    .concat(' → ∅')
})

function onNodeClick(nodeId) {
  const result = checkPick(frame.value, nodeId)
  if (result.ok) {
    picks.value.push(nodeId)
    feedback.value = ''
  } else {
    feedback.value = result.message
  }
}

function undo() {
  if (picks.value.length) {
    picks.value.pop()
    feedback.value = ''
  }
}

function reset() {
  picks.value = []
  feedback.value = ''
}
</script>

<template>
  <article class="demo">
    <header class="head">
      <div class="head-main">
        <div class="crumb">链表 · 归并</div>
        <h2>合并两个有序链表 <span class="pill pill--easy">21 · 易</span></h2>
        <p class="lede">
          两条升序链表合成一条。<b>每轮取谁由你点</b> —— 点的是画布里的节点本身：它会被
          <b>搬</b>到下面的结果行，不是复制一个新的。
        </p>
      </div>
      <a class="external" href="https://leetcode.cn/problems/merge-two-sorted-lists/" target="_blank" rel="noreferrer">
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <div class="heads">
          <span>list1 头 = <b>{{ headOf('l1') }}</b></span>
          <span>list2 头 = <b>{{ headOf('l2') }}</b></span>
          <span>结果已接 <b>{{ frame.mergedCount }}</b> 个</span>
        </div>
        <span class="stage-side">上 list1 ｜ 中 list2 ｜ 下 结果链</span>
      </div>
      <ListCanvas
        :nodes="frame.nodes"
        :links="frame.links"
        :pointers="frame.pointers"
        :highlights="frame.highlights"
        :clickable="clickableIds"
        :rows="3"
        @node-click="onNodeClick"
      />
    </section>

    <section class="say" :class="{ 'say--ask': playing }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint">
        <span class="caret">▸</span>{{ frame.hint }}
      </p>
    </section>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.done" class="verdict verdict--ok">
      <b>合并完成。</b>{{ mergedLine }}。六个节点一个都没多也没少 —— 只是 next 指针被重新串了一遍。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>已接 <b>{{ frame.mergedCount }}</b> / {{ listA.length + listB.length }} 个</span>
        <span class="dot">·</span>
        <span>决策 <b>{{ picks.length }}</b> 次</span>
      </div>
      <div class="actions">
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button class="primary" :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关只练「谁小谁出队」。下面四题各多考一个东西，按顺序做。</p>
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
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.heads {
  display: flex;
  gap: 18px;
  font-size: 12.5px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.heads b {
  color: var(--text-strong);
  font-weight: 600;
  font-size: 14px;
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

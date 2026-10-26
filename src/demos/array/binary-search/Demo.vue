<script setup>
import { computed, ref } from 'vue'
import ArrayCanvas from '../../../components/ArrayCanvas.vue'
import { buildFrames, checkPick, DEFAULT_VALUES, DEFAULT_TARGET } from './engine.js'

/**
 * 交互模型：`picks` 是唯一的可变状态（用户每次点对了的下标）。
 * 帧序列由 picks 重放得出，所以撤销 = 弹栈、重来 = 清空，
 * 不需要单独维护「回退到哪一步」这种容易出错的游标逻辑。
 */
const values = DEFAULT_VALUES
const target = DEFAULT_TARGET

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
// —— 否则 registry 引组件、组件再引 registry，就绕成循环依赖了
defineProps({
  related: { type: Array, default: () => [] },
})

/**
 * 用 `?picks=4,7,5` 可以复现任意一次练习过程。
 * 因为帧序列本身就是 picks 的纯函数，这个功能几乎是免费的；
 * 它同时也让「某个中间状态长什么样」可以被截图和分享，而不是只能靠嘴描述。
 * 非法的下标不必在这里过滤 —— buildFrames 遇到对不上的 pick 会直接跳过。
 */
const picks = ref(
  (new URLSearchParams(window.location.search).get('picks') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number),
)
const feedback = ref('')

const frames = computed(() => buildFrames({ values, target, picks: picks.value }))
const frame = computed(() => frames.value[frames.value.length - 1])

const finished = computed(() => frame.value.found || frame.value.dead)
const waitingAsk = computed(() => !finished.value)
const remaining = computed(() => (frame.value.dead ? 0 : frame.value.high - frame.value.low + 1))

function onCellClick(index) {
  const result = checkPick(frame.value, index)
  if (result.ok) {
    picks.value.push(index)
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
        <div class="crumb">数组 · 查找</div>
        <h2>二分查找 <span class="pill pill--easy">704 · 易</span></h2>
        <p class="lede">
          升序数组里找一个数。中点不是画好的——<b>每一步的中点由你算、由你点</b>。点错了会告诉你错在哪。
        </p>
      </div>
      <a class="external" href="https://leetcode.cn/problems/binary-search/" target="_blank" rel="noreferrer">
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="target-row">
        <span class="target-label">要找的目标</span>
        <span class="target-value">{{ target }}</span>
        <span class="array-note">数组（升序）</span>
      </div>
      <ArrayCanvas
        :values="values"
        :pointers="[
          { name: 'low',  at: frame.low },
          { name: 'high', at: frame.high },
          { name: 'mid',  at: frame.mid, row: 1 },
        ]"
        :eliminated="frame.eliminated"
        :marks="frame.found ? { [frame.mid]: 'ok' } : frame.mid === null ? {} : { [frame.mid]: 'active' }"
        :clickable="!frame.found && !frame.dead"
        @cell-click="onCellClick"
      />
    </section>

    <section class="say" :class="{ 'say--ask': waitingAsk }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint">
        <span class="caret">▸</span>{{ frame.hint }}
      </p>
    </section>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.found" class="verdict verdict--ok">
      <b>命中。</b>一共比较 {{ frame.compares }} 次。线性查找最坏要 {{ values.length }} 次——
      「每比较一次排除一半」就是二分能把 O(n) 压到 O(log n) 的全部原因。
    </div>
    <div v-else-if="frame.dead" class="verdict verdict--bad">
      <b>区间已空。</b>{{ target }} 不在这组数据里。二分查找能明确回答「找不到」，这同样是它的价值。
    </div>

    <footer class="bar">
      <div class="stats">
        <span>比较 <b>{{ frame.compares }}</b> 次</span>
        <span class="dot">·</span>
        <span>区间 <b>[{{ frame.low }}, {{ frame.high }}]</b></span>
        <span class="dot">·</span>
        <span>待查 <b>{{ remaining }}</b> 个</span>
      </div>
      <div class="actions">
        <button :disabled="!picks.length" @click="undo">撤销一步</button>
        <button class="primary" :disabled="!picks.length" @click="reset">重来</button>
      </div>
    </footer>

    <section class="next">
      <h3>接着练</h3>
      <p class="next-note">这一关只练「排除一半」。下面四题各多考一个东西，按顺序做。</p>
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

.target-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}

.target-label {
  font-size: 12px;
  color: var(--text-dim);
}

.target-value {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 700;
  color: var(--warn);
}

.array-note {
  margin-left: auto;
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

.verdict--bad {
  background: #251717;
  border: 1px solid #55302e;
  color: #e8b0ac;
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

<script setup>
import { computed, ref } from 'vue'
import StackCanvas from '../../../components/StackCanvas.vue'
import { buildFrames, checkPick, DEFAULT_TEXT, INVALID_TEXT } from './engine.js'

/**
 * 交互模型沿用单帧结构：每次决策产 1 帧，picks 一变直接显示最后一帧。
 * 决策走三个按钮（压 / 弹 / 判无效），栈本身不可点。
 */
const text = ref(DEFAULT_TEXT)

// 「接着练」的题单由 App 从 registry 传进来，组件自己不去读 registry
defineProps({
  related: { type: Array, default: () => [] },
})

// picks 是 'push' / 'pop' / 'invalid' 的序列，?picks=push,push 可复现任意一次练习
const picks = ref(
  (new URLSearchParams(window.location.search).get('picks') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const feedback = ref('')

const frames = computed(() => buildFrames({ text: text.value, picks: picks.value }))
const frame = computed(() => frames.value[frames.value.length - 1])
const asking = computed(() => frame.value.phase === 'ask')
const consumedCount = computed(() => frame.value.chars.filter((c) => c.consumed).length)

function onPick(action) {
  const result = checkPick(frame.value, action)
  if (result.ok) {
    picks.value.push(action)
    feedback.value = ''
  } else {
    feedback.value = result.message
  }
}

/**
 * 有效 / 无效的对照是这个演示一半的价值：只有 ([)] 才会出现
 * 「栈顶不配对时该立刻判无效」这一步。切换即换一组世界，进度必须清空。
 */
function switchText(next) {
  if (text.value === next) return
  text.value = next
  picks.value = []
  feedback.value = ''
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
        <div class="crumb">栈 · 配对</div>
        <h2>有效的括号 <span class="pill pill--easy">20 · 易</span></h2>
        <p class="lede">
          从左往右读括号串。<b>每个字符该压栈、该弹出还是该判无效，由你来定</b> —— 答错会告诉你为什么。
        </p>
      </div>
      <a class="external" href="https://leetcode.cn/problems/valid-parentheses/" target="_blank" rel="noreferrer">
        去刷原题 ↗
      </a>
    </header>

    <section class="stage">
      <div class="stage-row">
        <div class="modes">
          <button class="mode-btn" :class="{ 'mode-btn--on': text === DEFAULT_TEXT }" @click="switchText(DEFAULT_TEXT)">
            有效  ([{}])
          </button>
          <button class="mode-btn" :class="{ 'mode-btn--on': text === INVALID_TEXT }" @click="switchText(INVALID_TEXT)">
            无效  ([)])
          </button>
        </div>
        <span class="stage-side">左边是输入串，右边是栈（栈顶在上）</span>
      </div>

      <div class="board">
        <!-- 字符格是本演示专用的横排小格子，不复用 ArrayCanvas：
             那个组件的语义是「数组 + 指针 + 排除区」，这里只需要一串字符加高亮 -->
        <div class="chars">
          <div
            v-for="(c, i) in frame.chars"
            :key="c.id"
            class="char"
            :class="{ 'char--now': i === frame.cursor && asking, 'char--done': c.consumed }"
          >
            {{ c.ch }}
          </div>
        </div>
        <div class="stack-side">
          <StackCanvas :items="frame.stack" :capacity="4" />
        </div>
      </div>
    </section>

    <section class="say" :class="{ 'say--ask': asking }">
      <p class="say-text">{{ frame.caption }}</p>
      <p class="say-hint">
        <span class="caret">▸</span>{{ frame.hint }}
      </p>
    </section>

    <div v-if="asking" class="ask">
      <p class="ask-prompt">当前字符是「{{ frame.chars[frame.cursor].ch }}」—— 对它做什么？</p>
      <div class="ask-options">
        <button class="ask-btn" @click="onPick('push')">压入栈</button>
        <button class="ask-btn" @click="onPick('pop')">弹出并配对</button>
        <button class="ask-btn" @click="onPick('invalid')">判定无效</button>
      </div>
    </div>

    <p v-if="feedback" class="feedback">{{ feedback }}</p>

    <div v-if="frame.valid === true" class="verdict verdict--ok">
      <b>有效。</b>所有右括号都找到了对应的左括号，串读完时栈正好清空。
    </div>
    <div v-else-if="frame.valid === false" class="verdict verdict--bad">
      <b>无效。</b>{{ frame.reason }}
    </div>

    <footer class="bar">
      <div class="stats">
        <span>已处理 <b>{{ consumedCount }}</b> / {{ text.length }}</span>
        <span class="dot">·</span>
        <span>栈深 <b>{{ frame.stack.length }}</b></span>
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
      <p class="next-note">这一关只练「栈怎么配括号」。下面四题各多考一个东西，按顺序做。</p>
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
  padding: 18px 20px 16px;
  margin-bottom: 16px;
}

.stage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.modes {
  display: flex;
  gap: 8px;
}

.mode-btn {
  font-size: 12.5px;
  padding: 5px 12px;
  font-family: var(--font-mono);
}

.mode-btn--on {
  background: #1b3b66;
  border-color: #2f5f9e;
  color: var(--text-strong);
}

.stage-side {
  font-size: 11.5px;
  color: var(--text-dim);
}

/* 左右分栏：flex-end 让字符格子的底边和栈底对齐，视觉上「读进来、堆上去」 */
.board {
  display: flex;
  justify-content: center;
  gap: 40px;
  align-items: flex-end;
}

.chars {
  display: flex;
  gap: 8px;
  padding-bottom: 24px; /* 补齐栈画布底部的「栈底」标注高度，让两边真正贴齐 */
}

.char {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1.5px solid var(--cell-line);
  background: var(--cell-bg);
  color: var(--text-strong);
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 600;
  user-select: none;
  transition:
    opacity 0.3s ease,
    background 0.3s ease,
    border-color 0.3s ease;
}

.char--now {
  background: var(--cell-mid);
  border-color: var(--cell-mid-line);
  border-width: 2px;
}

.char--done {
  opacity: 0.3;
}

.stack-side {
  flex: none;
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
  flex: 1 1 140px;
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

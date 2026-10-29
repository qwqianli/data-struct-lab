import BinarySearchDemo from '../demos/array/binary-search/Demo.vue'
import TwoSumSortedDemo from '../demos/array/two-sum-sorted/Demo.vue'
import ReverseListDemo from '../demos/linked-list/reverse-list/Demo.vue'
import LinkedCycleDemo from '../demos/linked-list/linked-cycle/Demo.vue'
import MergeTwoListsDemo from '../demos/linked-list/merge-two-lists/Demo.vue'
import ValidParenthesesDemo from '../demos/stack/valid-parentheses/Demo.vue'
import DailyTemperaturesDemo from '../demos/stack/daily-temperatures/Demo.vue'
import SlidingWindowMaxDemo from '../demos/queue/sliding-window-max/Demo.vue'
import TwoSumDemo from '../demos/hash/two-sum/Demo.vue'
import LongestConsecutiveDemo from '../demos/hash/longest-consecutive/Demo.vue'
import GroupAnagramsDemo from '../demos/hash/group-anagrams/Demo.vue'
import InorderTraversalDemo from '../demos/tree/inorder-traversal/Demo.vue'
import LevelOrderDemo from '../demos/tree/level-order/Demo.vue'
import MaxDepthDemo from '../demos/tree/max-depth/Demo.vue'
import ValidateBstDemo from '../demos/tree/validate-bst/Demo.vue'
import KthLargestDemo from '../demos/heap/kth-largest/Demo.vue'
import TopKFrequentDemo from '../demos/heap/top-k-frequent/Demo.vue'
import MedianFinderDemo from '../demos/heap/median-finder/Demo.vue'
import NumIslandsDemo from '../demos/graph/num-islands/Demo.vue'
import CourseScheduleDemo from '../demos/graph/course-schedule/Demo.vue'

/**
 * 演示注册表 —— 全部 22 个演示的唯一事实来源。
 *
 * 链接与题号已于 2026-10-25 用 leetcode.cn 的题库接口逐个校验过，
 * 不要凭记忆改 slug：leetcode.cn 对任意路径都返回 200（SPA 兜底），
 * 所以「能打开」不等于「题目存在」，只能用接口反查。
 *
 * 标题统一用通用中文术语，不复制 LeetCode 题面（题面有版权）。
 * 付费题（paid_only）一条都没有，将来加题时也要避开 —— 链接点过去要能提交。
 */
export const CATEGORIES = [
  {
    key: 'array',
    label: '数组',
    demos: [
      {
        id: 'binary-search',
        title: '二分查找',
        no: 704,
        slug: 'binary-search',
        difficulty: '易',
        blurb: '每次比较排除一半',
        status: 'ready',
        component: BinarySearchDemo,
        // 每条都要求：链接能提交、题号与 slug 已校验、一句话说清「这题多考了什么」
        related: [
          {
            no: 35,
            slug: 'search-insert-position',
            title: '搜索插入位置',
            difficulty: '易',
            why: '循环结束时 low > high，而 low 恰好就是该插入的位置',
          },
          {
            no: 34,
            slug: 'find-first-and-last-position-of-element-in-sorted-array',
            title: '查找元素的第一个和最后一个位置',
            difficulty: '中',
            why: '命中之后不能立刻返回，要继续往同侧二分找边界',
          },
          {
            no: 69,
            slug: 'sqrtx',
            title: 'x 的平方根',
            difficulty: '易',
            why: '被二分的对象不一定是数组，也可以是答案的取值范围',
          },
          {
            no: 33,
            slug: 'search-in-rotated-sorted-array',
            title: '搜索旋转排序数组',
            difficulty: '中',
            why: '每一轮总有一半是有序的，先判断哪半有序再决定丢哪边',
          },
        ],
      },
      {
        id: 'two-sum-sorted',
        title: '双指针 · 两数之和 II',
        no: 167,
        slug: 'two-sum-ii-input-array-is-sorted',
        difficulty: '中',
        blurb: '左右夹逼，和大了右缩、和小了左进',
        status: 'ready',
        component: TwoSumSortedDemo,
        related: [
          {
            no: 1,
            slug: 'two-sum',
            title: '两数之和',
            difficulty: '易',
            why: '同一道题的乱序版本：数组无序就用不了双指针，只能上哈希表 —— 对比这两题能看清「有序」到底值多少钱',
          },
          {
            no: 11,
            slug: 'container-with-most-water',
            title: '盛最多水的容器',
            difficulty: '中',
            why: '同样是左右夹逼，但移动规则换成了「移动矮的那边」，贪心依据不同',
          },
          {
            no: 15,
            slug: '3sum',
            title: '三数之和',
            difficulty: '中',
            why: '固定一个数，剩下两个用本题的双指针 —— 双指针最经典的组合用法',
          },
          {
            no: 977,
            slug: 'squares-of-a-sorted-array',
            title: '有序数组的平方',
            difficulty: '易',
            why: '从两端往中间走：平方最大的数一定在两端，不在中间',
          },
        ],
      },
    ],
  },
  {
    key: 'linked-list',
    label: '链表',
    demos: [
      {
        id: 'reverse-list',
        title: '反转链表',
        no: 206,
        slug: 'reverse-linked-list',
        difficulty: '易',
        blurb: '三个指针在走位中换向',
        status: 'ready',
        component: ReverseListDemo,
        related: [
          {
            no: 24,
            slug: 'swap-nodes-in-pairs',
            title: '两两交换链表中的节点',
            difficulty: '中',
            why: '反转的缩小版：一次只处理两个，指针数量和顺序完全一样',
          },
          {
            no: 92,
            slug: 'reverse-linked-list-ii',
            title: '反转链表 II',
            difficulty: '中',
            why: '只反转中间一段，难点变成「接回原来的前后」',
          },
          {
            no: 25,
            slug: 'reverse-nodes-in-k-group',
            title: 'K 个一组翻转链表',
            difficulty: '难',
            why: '92 的加强版：把「每 k 个一反转」变成循环',
          },
          {
            no: 234,
            slug: 'palindrome-linked-list',
            title: '回文链表',
            difficulty: '易',
            why: '反转不是目的而是手段：反转后半段，再双指针比对',
          },
        ],
      },
      {
        id: 'linked-cycle',
        title: '环形链表 · 快慢指针',
        no: 141,
        slug: 'linked-list-cycle',
        difficulty: '易',
        blurb: '快的追慢的，追上就是有环',
        status: 'ready',
        component: LinkedCycleDemo,
        related: [
          {
            no: 876,
            slug: 'middle-of-the-linked-list',
            title: '链表的中间结点',
            difficulty: '易',
            why: '快慢指针最基础的应用：快的走两步、慢的走一步，快的到头时慢的正好在中点',
          },
          {
            no: 142,
            slug: 'linked-list-cycle-ii',
            title: '环形链表 II',
            difficulty: '中',
            why: '本题的续集：相遇之后怎么找回环的入口，要用到相遇点到入口的距离关系',
          },
          {
            no: 202,
            slug: 'happy-number',
            title: '快乐数',
            difficulty: '易',
            why: '同样的快慢指针，但「链」是一串算出来的数字，不是指针连起来的节点',
          },
          {
            no: 287,
            slug: 'find-the-duplicate-number',
            title: '寻找重复数',
            difficulty: '中',
            why: '把数组下标当成 next，重复的数就是环的入口 —— 抽象程度最高的一步',
          },
        ],
      },
      {
        id: 'merge-two-lists',
        title: '合并两个有序链表',
        no: 21,
        slug: 'merge-two-sorted-lists',
        difficulty: '易',
        blurb: '两个队头比大小，谁小谁出队',
        status: 'ready',
        component: MergeTwoListsDemo,
        related: [
          {
            no: 23,
            slug: 'merge-k-sorted-lists',
            title: '合并 K 个升序链表',
            difficulty: '难',
            why: '把本题的两两合并套进堆或分治，规模一上去，复杂度就差出来了',
          },
          {
            no: 88,
            slug: 'merge-sorted-array',
            title: '合并两个有序数组',
            difficulty: '易',
            why: '同一个思路换到数组：为了不覆盖，得从后往前填',
          },
          {
            no: 148,
            slug: 'sort-list',
            title: '排序链表',
            difficulty: '中',
            why: '归并排序的合并步骤就是本题，前半段是快慢指针找中点（141 那套）',
          },
          {
            no: 2,
            slug: 'add-two-numbers',
            title: '两数相加',
            difficulty: '中',
            why: '同样是两条链同步走，但多了进位，边界更碎',
          },
        ],
      },
    ],
  },
  {
    key: 'stack',
    label: '栈',
    demos: [
      {
        id: 'valid-parentheses',
        title: '有效的括号',
        no: 20,
        slug: 'valid-parentheses',
        difficulty: '易',
        blurb: '后进先出，天然配括号',
        status: 'ready',
        component: ValidParenthesesDemo,
        related: [
          {
            no: 1047,
            slug: 'remove-all-adjacent-duplicates-in-string',
            title: '删除字符串中的所有相邻重复项',
            difficulty: '易',
            why: '栈最直白的应用：新字符和栈顶一样就消掉，本质和「配对」是同一件事',
          },
          {
            no: 150,
            slug: 'evaluate-reverse-polish-notation',
            title: '逆波兰表达式求值',
            difficulty: '中',
            why: '栈里不再存括号而是存数字；遇到运算符就弹出两个来算，再压回去',
          },
          {
            no: 394,
            slug: 'decode-string',
            title: '字符串解码',
            difficulty: '中',
            why: '栈里同时存「重复次数」和「已经解好的前缀」，是本题的多状态版',
          },
          {
            no: 32,
            slug: 'longest-valid-parentheses',
            title: '最长有效括号',
            difficulty: '难',
            why: '本题的进阶：不光要判断整体是否有效，还要找出最长的那一段',
          },
        ],
      },
      {
        id: 'daily-temperatures',
        title: '每日温度 · 单调栈',
        no: 739,
        slug: 'daily-temperatures',
        difficulty: '中',
        blurb: '栈里留的全是「还没等到更暖」的天',
        status: 'ready',
        component: DailyTemperaturesDemo,
        related: [
          {
            no: 496,
            slug: 'next-greater-element-i',
            title: '下一个更大元素 I',
            difficulty: '易',
            why: '同一套单调栈，只是答案不是「差几天」而是「那个更大的值本身」',
          },
          {
            no: 503,
            slug: 'next-greater-element-ii',
            title: '下一个更大元素 II',
            difficulty: '中',
            why: '数组首尾相接成环，遍历两遍就能复用本题的写法',
          },
          {
            no: 84,
            slug: 'largest-rectangle-in-histogram',
            title: '柱状图中最大的矩形',
            difficulty: '难',
            why: '单调栈的经典难题：弹出时结算「以它为高的最大矩形」，比本题多一层计算',
          },
          {
            no: 42,
            slug: 'trapping-rain-water',
            title: '接雨水',
            difficulty: '难',
            why: '同样是「等一个更高的」，但栈里要同时算出左右两侧的高度差',
          },
        ],
      },
    ],
  },
  {
    key: 'queue',
    label: '队列',
    demos: [
      {
        id: 'sliding-window-max',
        title: '滑动窗口最大值 · 单调队列',
        no: 239,
        slug: 'sliding-window-maximum',
        difficulty: '难',
        blurb: '窗口右进左出，队首永远是最大值',
        status: 'ready',
        component: SlidingWindowMaxDemo,
        related: [
          {
            no: 3,
            slug: 'longest-substring-without-repeating-characters',
            title: '无重复字符的最长子串',
            difficulty: '中',
            why: '最基础的滑动窗口：窗口内用一个集合判重，右边界进、左边界缩',
          },
          {
            no: 1438,
            slug: 'longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit',
            title: '绝对差不超过限制的最长连续子数组',
            difficulty: '中',
            why: '两个单调队列同时维护窗口的最大值和最小值，是本题的直接扩展',
          },
          {
            no: 76,
            slug: 'minimum-window-substring',
            title: '最小覆盖子串',
            difficulty: '难',
            why: '滑动窗口的另一种形态：右边界扩到满足条件，再收缩左边界找最优',
          },
          {
            no: 480,
            slug: 'sliding-window-median',
            title: '滑动窗口的中位数',
            difficulty: '难',
            why: '窗口里要的不是最大值而是中位数，靠堆或有序容器，比单调队列更重',
          },
        ],
      },
    ],
  },
  {
    key: 'hash',
    label: '哈希表',
    demos: [
      {
        id: 'two-sum',
        title: '两数之和 · 哈希表',
        no: 1,
        slug: 'two-sum',
        difficulty: '易',
        blurb: '先查补数还是先存自己？顺序错了会自己配上自己',
        status: 'ready',
        component: TwoSumDemo,
        related: [
          {
            no: 167,
            slug: 'two-sum-ii-input-array-is-sorted',
            title: '两数之和 II - 输入有序数组',
            difficulty: '中',
            why: '数组有序时双指针就够了——对比着看哈希表什么时候是必要的',
          },
          {
            no: 454,
            slug: '4sum-ii',
            title: '四数相加 II',
            difficulty: '中',
            why: '哈希的进阶用法：把两两之和先存进表，四次方降到平方',
          },
          {
            no: 15,
            slug: '3sum',
            title: '三数之和',
            difficulty: '中',
            why: '排序 + 双指针；顺带想一下为什么这道题反而不适合存哈希表',
          },
          {
            no: 18,
            slug: '4sum',
            title: '四数之和',
            difficulty: '难',
            why: '双指针推广到四数，剪枝比数据结构更要紧',
          },
        ],
      },
      {
        id: 'group-anagrams',
        title: '字母异位词分组 · 哈希映射',
        no: 49,
        slug: 'group-anagrams',
        difficulty: '中',
        blurb: '同一个桶不等于同一个 key，链要挨个比',
        status: 'ready',
        component: GroupAnagramsDemo,
        related: [
          {
            no: 242,
            slug: 'valid-anagram',
            title: '有效的字母异位词',
            difficulty: '易',
            why: '签名的另一半用法：不排序，用 26 格计数表',
          },
          {
            no: 438,
            slug: 'find-all-anagrams-in-a-string',
            title: '找到字符串中所有字母异位词',
            difficulty: '中',
            why: '把签名换成滑动窗口里的字符计数',
          },
          {
            no: 347,
            slug: 'top-k-frequent-elements',
            title: '前 K 个高频元素',
            difficulty: '中',
            why: 'key 换成「数字 → 次数」，哈希计数接在前面',
          },
          {
            no: 532,
            slug: 'k-diff-pairs-in-an-array',
            title: '数组中的 K-diff 数对',
            difficulty: '中',
            why: '把等价类压成一个 key 的又一次实践',
          },
        ],
      },
      {
        id: 'longest-consecutive',
        title: '最长连续序列 · 哈希集合',
        no: 128,
        slug: 'longest-consecutive-sequence',
        difficulty: '中',
        blurb: 'n-1 不在表里，n 才配当起点',
        status: 'ready',
        component: LongestConsecutiveDemo,
        related: [
          {
            no: 217,
            slug: 'contains-duplicate',
            title: '存在重复元素',
            difficulty: '易',
            why: '最朴素的集合判重',
          },
          {
            no: 268,
            slug: 'missing-number',
            title: '丢失的数字',
            difficulty: '易',
            why: '集合的另一面：找「该在而不在」的那个数',
          },
          {
            no: 442,
            slug: 'find-all-duplicates-in-an-array',
            title: '数组中重复的数据',
            difficulty: '中',
            why: '不用额外表、原地做标记也能「记事」',
          },
          {
            no: 560,
            slug: 'subarray-sum-equals-k',
            title: '和为 K 的子数组',
            difficulty: '中',
            why: '前缀和 + 哈希，和 454 同族：存一个量，换 O(1) 查询',
          },
        ],
      },
    ],
  },
  {
    key: 'tree',
    label: '二叉树',
    demos: [
      {
        id: 'inorder-traversal',
        title: '二叉树的中序遍历',
        no: 94,
        slug: 'binary-tree-inorder-traversal',
        difficulty: '易',
        blurb: '左 → 根 → 右，递归与显式栈的对照',
        status: 'ready',
        component: InorderTraversalDemo,
        related: [
          {
            no: 101,
            slug: 'symmetric-tree',
            title: '对称二叉树',
            difficulty: '易',
            why: '判断镜像要比两棵子树的对边，不是同一棵的父子',
          },
          {
            no: 226,
            slug: 'invert-binary-tree',
            title: '翻转二叉树',
            difficulty: '易',
            why: '左右孩子互换，中序序列当场反过来',
          },
          {
            no: 103,
            slug: 'binary-tree-zigzag-level-order-traversal',
            title: '二叉树的锯齿形层序遍历',
            difficulty: '中',
            why: '同一批节点，输出顺序随深度奇偶翻转',
          },
          {
            no: 199,
            slug: 'binary-tree-right-side-view',
            title: '二叉树的右视图',
            difficulty: '中',
            why: '每层只留最右一个，是遍历口径的收窄',
          },
        ],
      },
      {
        id: 'level-order',
        title: '二叉树的层序遍历',
        no: 102,
        slug: 'binary-tree-level-order-traversal',
        difficulty: '中',
        blurb: '队列 + 每层计数，一行一行扫',
        status: 'ready',
        component: LevelOrderDemo,
        related: [
          {
            no: 199,
            slug: 'binary-tree-right-side-view',
            title: '二叉树的右视图',
            difficulty: '中',
            why: '层序只留每层最后一个',
          },
          {
            no: 103,
            slug: 'binary-tree-zigzag-level-order-traversal',
            title: '二叉树的锯齿形层序遍历',
            difficulty: '中',
            why: '同层顺序按深度奇偶倒过来',
          },
          {
            no: 637,
            slug: 'average-of-levels-in-binary-tree',
            title: '二叉树的层平均值',
            difficulty: '易',
            why: '同层节点先收集再聚合',
          },
          {
            no: 111,
            slug: 'minimum-depth-of-binary-tree',
            title: '二叉树的最小深度',
            difficulty: '易',
            why: 'BFS 第一次撞到叶就是答案',
          },
        ],
      },
      {
        id: 'max-depth',
        title: '二叉树的最大深度',
        no: 104,
        slug: 'maximum-depth-of-binary-tree',
        difficulty: '易',
        blurb: '递归的回溯过程长什么样',
        status: 'ready',
        component: MaxDepthDemo,
        related: [
          {
            no: 111,
            slug: 'minimum-depth-of-binary-tree',
            title: '二叉树的最小深度',
            difficulty: '易',
            why: '叶判定：一边为空不算最小',
          },
          {
            no: 110,
            slug: 'balanced-binary-tree',
            title: '平衡二叉树',
            difficulty: '易',
            why: '回溯要么返回深度、要么 -1 短路',
          },
          {
            no: 543,
            slug: 'diameter-of-binary-tree',
            title: '二叉树的直径',
            difficulty: '易',
            why: '回溯带上去的不是深度是路径长',
          },
          {
            no: 226,
            slug: 'invert-binary-tree',
            title: '翻转二叉树',
            difficulty: '易',
            why: '同一趟 DFS，改的是形状不是数值',
          },
        ],
      },
      {
        id: 'validate-bst',
        title: '验证二叉搜索树',
        no: 98,
        slug: 'validate-binary-search-tree',
        difficulty: '中',
        blurb: '只比较父子节点是不够的，要传上下界',
        status: 'ready',
        component: ValidateBstDemo,
        related: [
          {
            no: 101,
            slug: 'symmetric-tree',
            title: '对称二叉树',
            difficulty: '易',
            why: '比较对象换成两棵子树的镜像对',
          },
          {
            no: 112,
            slug: 'path-sum',
            title: '路径总和',
            difficulty: '易',
            why: '沿路累计的判据换成和',
          },
          {
            no: 236,
            slug: 'lowest-common-ancestor-of-a-binary-tree',
            title: '二叉树的最近公共祖先',
            difficulty: '中',
            why: '回溯返回的是分叉点',
          },
          {
            no: 543,
            slug: 'diameter-of-binary-tree',
            title: '二叉树的直径',
            difficulty: '易',
            why: '同样要传一个随路径变化的量',
          },
        ],
      },
    ],
  },
  {
    key: 'heap',
    label: '堆',
    demos: [
      {
        id: 'kth-largest',
        title: '数组中第 K 大的元素',
        no: 215,
        slug: 'kth-largest-element-in-an-array',
        difficulty: '中',
        blurb: '小顶堆只留 K 个，堆顶就是答案',
        status: 'ready',
        component: KthLargestDemo,
        related: [
          {
            no: 347,
            slug: 'top-k-frequent-elements',
            title: '前 K 个高频元素',
            difficulty: '中',
            why: '同样是小顶堆，比较的键从数值换成频率',
          },
          {
            no: 295,
            slug: 'find-median-from-data-stream',
            title: '数据流的中位数',
            difficulty: '难',
            why: '两个堆对着维护，取中位数就是两个堆顶',
          },
          {
            no: 23,
            slug: 'merge-k-sorted-lists',
            title: '合并 K 个升序链表',
            difficulty: '难',
            why: 'k 路归并也是用堆挑最小',
          },
          {
            no: 703,
            slug: 'kth-largest-element-in-a-stream',
            title: '数据流中的第 K 大元素',
            difficulty: '易',
            why: '数据流版本，堆永远保持 k 个',
          },
        ],
      },
      {
        id: 'top-k-frequent',
        title: '前 K 个高频元素',
        no: 347,
        slug: 'top-k-frequent-elements',
        difficulty: '中',
        blurb: '先用哈希数频率，再用堆筛 K 个',
        status: 'ready',
        component: TopKFrequentDemo,
        related: [
          {
            no: 215,
            slug: 'kth-largest-element-in-an-array',
            title: '数组中第 K 大的元素',
            difficulty: '中',
            why: '同样是小顶堆，比较的键从数值换成频率',
          },
          {
            no: 295,
            slug: 'find-median-from-data-stream',
            title: '数据流的中位数',
            difficulty: '难',
            why: '两个堆对着维护',
          },
          {
            no: 692,
            slug: 'top-k-frequent-words',
            title: '前 K 个高频单词',
            difficulty: '中',
            why: '频率相同再按字典序，比较器要多一层',
          },
          {
            no: 451,
            slug: 'sort-characters-by-frequency',
            title: '根据字符出现频率排序',
            difficulty: '中',
            why: '只要频次排序结果，那就干脆桶排序',
          },
        ],
      },
      {
        id: 'median-finder',
        title: '数据流的中位数 · 双堆',
        no: 295,
        slug: 'find-median-from-data-stream',
        difficulty: '难',
        blurb: '大顶堆存小的一半，小顶堆存大的一半',
        status: 'ready',
        component: MedianFinderDemo,
        related: [
          {
            no: 703,
            slug: 'kth-largest-element-in-a-stream',
            title: '数据流中的第 K 大元素',
            difficulty: '易',
            why: '只要第 K 大，一个大小为 K 的堆就够',
          },
          {
            no: 480,
            slug: 'sliding-window-median',
            title: '滑动窗口中位数',
            difficulty: '难',
            why: '窗口会滑动，搬移还要处理过期元素',
          },
          {
            no: 215,
            slug: 'kth-largest-element-in-an-array',
            title: '数组中第 K 大的元素',
            difficulty: '中',
            why: '一个堆 vs 两个堆，规模差一半',
          },
          {
            no: 347,
            slug: 'top-k-frequent-elements',
            title: '前 K 个高频元素',
            difficulty: '中',
            why: '同样是堆，那边的键是频率',
          },
        ],
      },
    ],
  },
  {
    key: 'graph',
    label: '图',
    demos: [
      {
        id: 'num-islands',
        title: '岛屿数量 · DFS',
        no: 200,
        slug: 'number-of-islands',
        difficulty: '中',
        blurb: '淹掉一个岛，再找下一个',
        status: 'ready',
        component: NumIslandsDemo,
        related: [
          { no: 994, slug: 'rotting-oranges', title: '腐烂的橘子', difficulty: '中', why: '一样的网格和四邻，换个方向：多源同时扩散' },
          { no: 695, slug: 'max-area-of-island', title: '岛屿的最大面积', difficulty: '中', why: '同样要淹岛，但要在淹之前量面积' },
          { no: 463, slug: 'island-perimeter', title: '岛屿的周长', difficulty: '易', why: '不求岛数，只数贴边的格子边' },
          { no: 130, slug: 'surrounded-regions', title: '被围绕的区域', difficulty: '中', why: '从边上的水开始淹，剩下的才是被围住的' },
        ],
      },
      {
        id: 'rotten-oranges',
        title: '腐烂的橘子 · 多源 BFS',
        no: 994,
        slug: 'rotting-oranges',
        difficulty: '中',
        blurb: '所有腐烂的橘子同时开始扩散',
        status: 'planned',
      },
      {
        id: 'course-schedule',
        title: '课程表 · 拓扑排序',
        no: 207,
        slug: 'course-schedule',
        difficulty: '中',
        blurb: '入度为 0 的先修，剥到最后看还剩没剩',
        status: 'ready',
        component: CourseScheduleDemo,
        related: [
          {
            no: 210,
            slug: 'course-schedule-ii',
            title: '课程表 II',
            difficulty: '中',
            why: '同一条剥法，但要把剥下的顺序留下来当答案',
          },
          {
            no: 802,
            slug: 'find-eventual-safe-states',
            title: '找到最终的安全状态',
            difficulty: '中',
            why: '也靠「剥不动就有环」，只是从出度为 0 的终点往回剥',
          },
          {
            no: 743,
            slug: 'network-delay-time',
            title: '网络延迟时间',
            difficulty: '中',
            why: '图从无权变带权，入度换成距离，下一步是 Dijkstra',
          },
          {
            no: 133,
            slug: 'clone-graph',
            title: '克隆图',
            difficulty: '中',
            why: '先把图用邻接表存下来，再谈遍历',
          },
        ],
      },
      {
        id: 'network-delay',
        title: '网络延迟时间 · Dijkstra',
        no: 743,
        slug: 'network-delay-time',
        difficulty: '中',
        blurb: '每次取当前最近的节点，再松弛它的邻居',
        status: 'planned',
      },
    ],
  },
]

export const ALL_DEMOS = CATEGORIES.flatMap((c) => c.demos.map((d) => ({ ...d, category: c.key, categoryLabel: c.label })))

export const TOTAL_DEMOS = ALL_DEMOS.length
export const READY_DEMOS = ALL_DEMOS.filter((d) => d.status === 'ready').length

export function leetcodeUrl(demo) {
  return `https://leetcode.cn/problems/${demo.slug}/`
}

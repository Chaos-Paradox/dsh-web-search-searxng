#!/usr/bin/env node
/**
 * End-to-end quality comparison through the REAL product path: each question
 * is answered by an actual dsh agent (headless profile) that must call the
 * web_search tool. With the config-effects host, installation journals
 * web.searchProvider: searxng into the profile patch, so BOTH rounds pin
 * their route explicitly through an invocation-layer `dsh --patch`: round
 * "searxng" applies benchmarks/e2e-searxng.patch.yml (endpoint only — the
 * journal owns the route), round "official" applies
 * benchmarks/e2e-official.patch.yml (pins searchProvider: deepseek-official
 * back and disables the plugin row so its activation gate stays silent).
 * The agent model, preset, tools, and prompts are identical across rounds —
 * only the provider differs.
 *
 * A blinded judge model grades both final answers per question. Raw events,
 * answers, and scores land in benchmarks/results/.
 *
 *   node benchmarks/e2e-comparison.mjs            # full run
 *   node benchmarks/e2e-comparison.mjs c14 pnpm   # selected questions only
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const DSH = ['/Users/pioneer/AIWork/deepseek-harness/apps/cli/lib/bin.js']
const PATCH = join(HERE, 'e2e-searxng.patch.yml')
const OFFICIAL_PATCH = join(HERE, 'e2e-official.patch.yml')
const CHAT_BASE = process.env.DEEPSEEK_CHAT_BASE_URL ?? 'https://api.deepseek.com'
const JUDGE_MODEL = process.env.DEEPSEEK_ANSWER_MODEL ?? 'deepseek-chat'
const RUN_TIMEOUT_MS = +(process.env.E2E_TIMEOUT_MS ?? 420_000)

const QUESTIONS = [
  { id: 'c14', lang: 'en', q: 'What is the half-life of carbon-14 used in radiocarbon dating?',
    points: ['约 5730 年（也常写 5,700/5730±40）', '说明它用于放射性碳定年'] },
  { id: 'http23', lang: 'en', q: 'What are the main differences between HTTP/2 and HTTP/3?',
    points: ['HTTP/2 跑在 TCP 上，HTTP/3 跑在 QUIC/UDP 上', 'HTTP/3 解决了 TCP 层面的队头阻塞', 'HTTP/3 默认加密（TLS 1.3 内置于 QUIC）'] },
  { id: 'nobel25', lang: 'en', q: 'Who won the 2025 Nobel Prize in Physics, and for what?',
    points: ['John Clarke、Michel H. Devoret、John M. Martinis', '宏观量子隧穿与电路中能量量子化'] },
  { id: 'hongloumeng', lang: 'zh', q: '《红楼梦》的作者是谁？后四十回一般认为由谁续写？',
    points: ['曹雪芹著前八十回', '后四十回一般认为高鹗续写（程伟元参与整理刊印）'] },
  { id: 'gdp2024', lang: 'zh', q: '中国 2024 年的 GDP 总量是多少？',
    points: ['约 134.9 万亿元人民币（初步核算约134.9万亿）', '同比增速约 5.0%'] },
  { id: 'pnpm', lang: 'zh', q: 'pnpm 的 link: 协议和 file: 协议有什么区别？',
    points: ['link: 创建符号链接指向本地目录，改动即时可见', 'file: 安装时打包/复制进 store，目录后续改动不生效'] },
  { id: 'searxng-json', lang: 'en', q: 'How do you enable JSON format output in SearXNG?',
    points: ['在 settings.yml 的 search.formats 中加入 json', '之后可用 /search?format=json'] },
  { id: 'vue-ref', lang: 'zh', q: 'Vue 3 组合式 API 中 ref 和 reactive 的区别是什么？',
    points: ['ref 可包装基本类型，通过 .value 访问', 'reactive 只接受对象，直接改属性', '模板中顶层 ref 自动解包'] },
  { id: 'node-lts', lang: 'en', q: 'What is the latest LTS version of Node.js?',
    points: ['给出一个具体的版本号', '说明 LTS 发布节奏（偶数版本进入 LTS）'] },
  { id: 'cny2026', lang: 'zh', q: '2026 年春节是几月几号？',
    points: ['2026 年 2 月 17 日（星期二）', '农历丙午年（马年）'] },
]

/** Same questions as the wire-level benchmark — instruct the agent to search first. */
function taskPrompt(question) {
  return question.lang === 'zh'
    ? `请先用 web_search 工具搜索，再基于搜索到的来源简要回答下面的问题，用 [1]、[2] 在句内标注来源。除 web_search 外不要使用其他工具。\n\n问题：${question.q}`
    : `First use the web_search tool, then answer the question below concisely based on the sources found, citing inline as [1], [2]. Do not use any tool other than web_search.\n\nQuestion: ${question.q}`
}

function apiKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  const yaml = readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')
  const refs = yaml.match(/^refs:\n((?:  \S.*\n)+)/m)?.[1] ?? ''
  const line = refs.split('\n').map(row => row.trim()).find(row => row.startsWith('DEEPSEEK_API_KEY:'))
  const value = line?.split(':')[1]?.trim().replace(/^["']|["']$/g, '')
  if (!value) throw new Error('DEEPSEEK_API_KEY not found')
  return value
}

const KEY = apiKey()

/**
 * Run one headless dsh task; returns the final assistant text plus how many
 * web_search tool calls the agent made and which provider errors surfaced.
 */
function runAgent(question, mode) {
  return new Promise((resolve) => {
    // Launcher flags first: once an unknown app flag (--json) appears, the
    // launcher passes the rest to the app verbatim, so --patch must precede it.
    // Both rounds pin their route explicitly: installation journaled the
    // SearXNG route into the profile patch, so an unpatched "official" round
    // would search through SearXNG too.
    const patch = mode === 'searxng' ? PATCH : OFFICIAL_PATCH
    const args = ['--profile', 'headless', '--patch', patch, '--json', taskPrompt(question)]
    const child = spawn('node', [...DSH, ...args], { cwd: HERE, env: process.env })
    let out = ''
    const killer = setTimeout(() => { child.kill('SIGKILL') }, RUN_TIMEOUT_MS)
    child.stdout.on('data', chunk => { out += chunk })
    child.stderr.on('data', () => {})
    child.on('close', code => {
      clearTimeout(killer)
      let finalText = ''
      let searches = 0
      let fetches = 0
      for (const line of out.split('\n')) {
        if (!line.trim().startsWith('{')) continue
        let event
        try { event = JSON.parse(line) } catch { continue }
        if (event.type === 'tool_call' && event.tool === 'web_search') searches += 1
        if (event.type === 'tool_call' && event.tool === 'web_fetch') fetches += 1
        if (event.type === 'final' && typeof event.text === 'string' && event.text.trim().length > 0) finalText = event.text
      }
      resolve({ code, finalText, searches, fetches, bytes: out.length, rawTail: out.slice(-4000) })
    })
  })
}

async function chat(messages, maxTokens = 2048) {
  const res = await fetch(`${CHAT_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: JUDGE_MODEL, max_tokens: maxTokens, messages }),
  })
  if (!res.ok) throw new Error(`judge HTTP ${res.status}`)
  const body = await res.json()
  return body.choices?.[0]?.message?.content ?? ''
}

async function judge(question, answerSearxng, answerOfficial) {
  const searxngIsA = Math.random() < 0.5
  const A = searxngIsA ? answerSearxng : answerOfficial
  const B = searxngIsA ? answerOfficial : answerSearxng
  const prompt = `你是严格的评审。给定一个问题、参考答案要点、以及两份匿名答案（A 和 B），分别打分。

问题：${question.q}

参考答案要点：
${question.points.map(p => `- ${p}`).join('\n')}

答案 A：
${A}

答案 B：
${B}

只输出 JSON（不要代码块、不要解释）：
{"A":{"accuracy":0,"completeness":0,"citations":0},"B":{"accuracy":0,"completeness":0,"citations":0},"winner":"A|B|tie","notes":"一句话理由"}
accuracy=事实与要点命中（0-5），completeness=完整性（0-5），citations=引用是否支撑论断（0-5）。`
  const text = await chat([{ role: 'user', content: prompt }])
  return { searxngIsA, scores: JSON.parse(text.replace(/```(?:json)?|```/g, '').trim()) }
}

async function run() {
  const only = process.argv.slice(2)
  const questions = only.length > 0 ? QUESTIONS.filter(q => only.includes(q.id)) : QUESTIONS
  const results = []
  for (const q of questions) {
    console.error(`[${q.id}] searxng round…`)
    const sx = await runAgent(q, 'searxng')
    console.error(`  exit=${sx.code} searches=${sx.searches} fetches=${sx.fetches} answer=${sx.finalText.length} chars`)
    console.error(`[${q.id}] official round…`)
    const of = await runAgent(q, 'official')
    console.error(`  exit=${of.code} searches=${of.searches} fetches=${of.fetches} answer=${of.finalText.length} chars`)
    const judged = (sx.finalText && of.finalText) ? await judge(q, sx.finalText, of.finalText) : null
    if (judged) {
      const s = judged.scores
      const a = judged.searxngIsA ? s.A : s.B
      const b = judged.searxngIsA ? s.B : s.A
      console.error(`  judge — searxng ${a.accuracy}/${a.completeness}/${a.citations}, official ${b.accuracy}/${b.completeness}/${b.citations}`)
    }
    results.push({ id: q.id, question: q.q, lang: q.lang, points: q.points, searxng: sx, official: of, judged })
  }
  const dir = join(HERE, 'results')
  await mkdir(dir, { recursive: true })
  const file = join(dir, `e2e-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  await writeFile(file, JSON.stringify({ config: { PATCH, OFFICIAL_PATCH, JUDGE_MODEL, RUN_TIMEOUT_MS }, results }, null, 2))
  console.log(`\nwrote ${file}`)
  // compact summary
  let wins = { searxng: 0, official: 0, tie: 0 }
  const acc = { searxng: [0, 0, 0], official: [0, 0, 0] }
  let n = 0
  for (const r of results) {
    if (!r.judged) continue
    n += 1
    const s = r.judged.scores
    const sx = r.judged.searxngIsA ? s.A : s.B
    const of = r.judged.searxngIsA ? s.B : s.A
    acc.searxng[0] += sx.accuracy; acc.searxng[1] += sx.completeness; acc.searxng[2] += sx.citations
    acc.official[0] += of.accuracy; acc.official[1] += of.completeness; acc.official[2] += of.citations
    const w = s.winner === 'tie' ? 'tie' : (s.winner === 'A') === r.judged.searxngIsA ? 'searxng' : 'official'
    wins[w] += 1
  }
  const avg = v => +(v / (n || 1)).toFixed(2)
  console.log(JSON.stringify({
    questions: n, wins,
    searxngAvg: { accuracy: avg(acc.searxng[0]), completeness: avg(acc.searxng[1]), citations: avg(acc.searxng[2]) },
    officialAvg: { accuracy: avg(acc.official[0]), completeness: avg(acc.official[1]), citations: avg(acc.official[2]) },
    searches: { searxng: results.reduce((k, r) => k + r.searxng.searches, 0), official: results.reduce((k, r) => k + r.official.searches, 0) },
  }, null, 2))
}

run().catch(error => { console.error(error); process.exit(1) })

#!/usr/bin/env node
/**
 * Controlled quality comparison: does the SearXNG provider degrade answers
 * relative to the built-in DeepSeek official provider?
 *
 * For each question the script runs BOTH providers, feeds each source set to
 * the same answer model with an identical prompt, and lets a blinded judge
 * model grade the two answers against reference points. Raw data lands in
 * benchmarks/results/ so every number in docs/quality-benchmark*.md can be
 * re-checked and re-run:
 *
 *   SEARXNG_BASE_URL=http://127.0.0.1:8080 node benchmarks/quality-comparison.mjs
 *
 * DEEPSEEK_API_KEY falls back to ~/.dsh/.credentials.yaml when unset.
 * The key never leaves the machine: it is only sent to api.deepseek.com.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'

const SEARXNG_BASE_URL = process.env.SEARXNG_BASE_URL ?? 'http://127.0.0.1:8080'
const SEARXNG_ENGINES = process.env.SEARXNG_ENGINES ?? 'startpage,mojeek'
const SEARCH_BASE = process.env.DEEPSEEK_SEARCH_BASE_URL ?? 'https://api.deepseek.com/anthropic/v1'
const CHAT_BASE = process.env.DEEPSEEK_CHAT_BASE_URL ?? 'https://api.deepseek.com'
const SEARCH_MODEL = process.env.DEEPSEEK_SEARCH_MODEL ?? 'deepseek-v4-flash'
const ANSWER_MODEL = process.env.DEEPSEEK_ANSWER_MODEL ?? 'deepseek-chat'
const TOP_K = 8

/** @returns {string} the DeepSeek key from env or the dsh credential store. */
function apiKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY
  const yaml = readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')
  const refs = yaml.match(/^refs:\n((?:  \S.*\n)+)/m)?.[1] ?? ''
  const line = refs.split('\n').map(row => row.trim()).find(row => row.startsWith('DEEPSEEK_API_KEY:'))
  const value = line?.split(':')[1]?.trim().replace(/^["']|["']$/g, '')
  if (!value) throw new Error('DEEPSEEK_API_KEY not found in env or ~/.dsh/.credentials.yaml')
  return value
}

const KEY = apiKey()

/** Ten questions: 5 zh / 5 en, stable facts plus a few timeliness probes. */
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

/** The plugin's exact mapping (src/provider.ts): url required, content→snippet. */
async function searxngSearch(q) {
  const url = new URL('search', SEARXNG_BASE_URL.replace(/\/?$/, '/'))
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'json')
  url.searchParams.set('engines', SEARXNG_ENGINES)
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`searxng HTTP ${res.status}`)
  const body = await res.json()
  return (body.results ?? [])
    .filter(r => typeof r.url === 'string' && r.url.trim().length > 0)
    .slice(0, TOP_K)
    .map(r => ({ url: r.url, ...(r.title ? { title: r.title } : {}), ...(r.content?.trim() ? { snippet: r.content } : {}), ...(r.publishedDate ? { publishedAt: r.publishedDate } : {}) }))
}

/** The official provider's wire format (dsh-web-search-deepseek/src/provider.ts). */
async function deepseekSearch(q) {
  const res = await fetch(`${SEARCH_BASE}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: SEARCH_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: [{ type: 'text', text: q }] }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    }),
  })
  if (!res.ok) throw new Error(`deepseek search HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const body = await res.json()
  const snippets = new Map()
  for (const block of body.content ?? []) {
    if (block.type !== 'text') continue
    for (const c of block.citations ?? []) {
      if (c.url && c.cited_text && !snippets.has(c.url)) snippets.set(c.url, c.cited_text)
    }
  }
  const seen = new Set()
  const sources = []
  for (const block of body.content ?? []) {
    if (block.type !== 'web_search_tool_result') continue
    for (const item of block.content ?? []) {
      if (item.type !== 'web_search_result' || !item.url || seen.has(item.url)) continue
      seen.add(item.url)
      sources.push({ url: item.url, ...(item.title ? { title: item.title } : {}), ...(snippets.get(item.url) ? { snippet: snippets.get(item.url) } : {}), ...(item.page_age ? { publishedAt: item.page_age } : {}) })
      if (sources.length >= TOP_K) return sources
    }
  }
  return sources
}

/** One chat completion against the answer/judge model. */
async function chat(messages, maxTokens = 2048) {
  const res = await fetch(`${CHAT_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: ANSWER_MODEL, max_tokens: maxTokens, messages }),
  })
  if (!res.ok) throw new Error(`chat HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const body = await res.json()
  return body.choices?.[0]?.message?.content ?? ''
}

/** Generate an answer from one source set, mimicking the agent's source-only use. */
function answerPrompt(question, sources, lang) {
  const list = sources.map((s, i) => `[${i + 1}] ${s.title ?? '(no title)'}\n    ${s.url}\n    ${s.snippet ?? ''}`).join('\n')
  return lang === 'zh'
    ? `你是研究助手。只依据以下来源简要回答问题，并在句内用 [1]、[2] 标注出处；来源不足就明说。\n\n问题：${question.q}\n\n来源：\n${list}`
    : `You are a research assistant. Using ONLY the sources below, answer the question concisely and cite inline as [1], [2]. If the sources are insufficient, say so.\n\nQuestion: ${question.q}\n\nSources:\n${list}`
}

/** Blinded judge: grade both answers against the reference points, order randomized. */
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
  const parsed = JSON.parse(text.replace(/```(?:json)?|```/g, '').trim())
  return { searxngIsA, scores: parsed }
}

const domainOf = url => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }

function jaccard(a, b) {
  const A = new Set(a), B = new Set(b)
  const inter = [...A].filter(x => B.has(x)).length
  return A.size + B.size === 0 ? 0 : inter / (A.size + B.size - inter)
}

async function run() {
  const results = []
  for (const q of QUESTIONS) {
    console.error(`[${q.id}] searching both providers…`)
    const [searxngSources, officialSources] = await Promise.all([
      searxngSearch(q.q).catch(e => ({ error: String(e) })),
      deepseekSearch(q.q).catch(e => ({ error: String(e) })),
    ])
    if (!Array.isArray(searxngSources) || !Array.isArray(officialSources)) {
      results.push({ id: q.id, question: q.q, searxngSources, officialSources, skipped: true })
      console.error(`  skipped: ${!Array.isArray(searxngSources) ? searxngSources.error : officialSources.error}`)
      continue
    }
    console.error(`  searxng ${searxngSources.length} sources, official ${officialSources.length} sources; generating answers…`)
    const [answerSearxng, answerOfficial] = await Promise.all([
      chat([{ role: 'user', content: answerPrompt(q, searxngSources, q.lang) }]),
      chat([{ role: 'user', content: answerPrompt(q, officialSources, q.lang) }]),
    ])
    const judged = await judge(q, answerSearxng, answerOfficial)
    const dSearxng = searxngSources.map(s => domainOf(s.url))
    const dOfficial = officialSources.map(s => domainOf(s.url))
    results.push({
      id: q.id, question: q.q, lang: q.lang, points: q.points,
      searxngSources, officialSources, answerSearxng, answerOfficial,
      retrieval: {
        domainJaccard: +jaccard(dSearxng, dOfficial).toFixed(3),
        sharedUrls: searxngSources.filter(s => officialSources.some(o => o.url === s.url)).length,
      },
      judged,
    })
    const s = judged.scores
    const sx = judged.searxngIsA ? s.A : s.B
    const of = judged.searxngIsA ? s.B : s.A
    console.error(`  judge — searxng ${sx.accuracy}/${sx.completeness}/${sx.citations}, official ${of.accuracy}/${of.completeness}/${of.citations}, winner(s-a side): ${judged.searxngIsA ? (s.winner === 'A' ? 'searxng' : s.winner === 'B' ? 'official' : 'tie') : (s.winner === 'B' ? 'searxng' : s.winner === 'A' ? 'official' : 'tie')}`)
  }

  const dir = new URL('./results/', import.meta.url).pathname
  await mkdir(dir, { recursive: true })
  const file = join(dir, `quality-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  const summary = summarize(results)
  await writeFile(file, JSON.stringify({ config: { SEARXNG_BASE_URL, SEARXNG_ENGINES, SEARCH_MODEL, ANSWER_MODEL, TOP_K }, summary, results }, null, 2))
  console.log(`\nwrote ${file}`)
  console.log(JSON.stringify(summary, null, 2))
}

/** Aggregate judge scores back onto the provider sides. */
function summarize(results) {
  const done = results.filter(r => !r.skipped && r.judged)
  const acc = { searxng: { accuracy: 0, completeness: 0, citations: 0, wins: 0 }, official: { accuracy: 0, completeness: 0, citations: 0, wins: 0 }, ties: 0, questions: done.length }
  for (const r of done) {
    const { scores: s, searxngIsA } = r.judged
    const sx = searxngIsA ? s.A : s.B
    const of = searxngIsA ? s.B : s.A
    for (const k of ['accuracy', 'completeness', 'citations']) { acc.searxng[k] += sx[k]; acc.official[k] += of[k] }
    const winner = s.winner === 'tie' ? 'tie' : (s.winner === 'A') === searxngIsA ? 'searxng' : 'official'
    if (winner === 'tie') acc.ties += 1; else acc[winner].wins += 1
  }
  for (const side of ['searxng', 'official']) for (const k of ['accuracy', 'completeness', 'citations']) acc[side][k] = +(acc[side][k] / (done.length || 1)).toFixed(2)
  acc.meanDomainJaccard = +(done.reduce((n, r) => n + r.retrieval.domainJaccard, 0) / (done.length || 1)).toFixed(3)
  return acc
}

run().catch(error => { console.error(error); process.exit(1) })

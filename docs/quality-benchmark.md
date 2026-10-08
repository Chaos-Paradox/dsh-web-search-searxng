# Quality Benchmark: SearXNG Provider vs the Official Provider

[中文](quality-benchmark.zh.md) | **English**

> **One-line takeaway**: with the same questions, the same answer model, and blinded judging, **switching to the SearXNG provider showed no answer-quality degradation** — in both a wire-level and a full **end-to-end** comparison (a real dsh agent making real `web_search` tool calls).

This plugin swaps the search source from DSH's built-in official search (`deepseek-official`) to your self-hosted SearXNG. A fair worry: **does a free, self-hosted metasearch feed the model worse material?** We answer it with two complementary experiments.

## Experiment 1: end-to-end comparison (primary evidence)

Script: [benchmarks/e2e-comparison.mjs](../benchmarks/e2e-comparison.mjs); raw data: [benchmarks/results/](../benchmarks/results/) (`e2e-*.json`, with event-stream digests and both answer texts).

This design is closest to real usage — **every question is answered by an actual dsh agent (headless profile) that must really call the `web_search` tool**, and the event stream verifies the search-call count per run:

```
Each question (10 total, 5 zh + 5 en)
  ├─ SearXNG round:  dsh --profile headless --patch e2e-searxng.patch.yml "<question>"
  │                  (installation journaled web.searchProvider: searxng into
  │                   the profile patch; the overlay only carries the endpoint —
  │                   engines bing,yahoo — for the local instance)
  ├─ Official round: dsh --profile headless --patch e2e-official.patch.yml "<question>"
  │                  (the invocation overlay pins searchProvider back to
  │                   deepseek-official for exactly one process)
  │   —— same agent model, same preset, same prompt across rounds;
  │      the only variable is the search provider; each prompt requires
  │      web_search before answering
  └─ Judge: blinded — the judge model (deepseek-chat) cannot see which
            answer came from which side; scores 0-5 on accuracy,
            completeness, citation support against per-question reference points
```

> **Layering note (config-effects host)**: installation applies `web.searchProvider: searxng` as a journaled write in the profile patch, so an *unpatched* official round would silently search through SearXNG too. Both rounds therefore pin their route explicitly at the invocation layer (the official round also disables the plugin row, so its activation gate stays silent). The published results below predate this mechanism: their SearXNG round pinned the route through an equivalent overlay and their official round used the base default — the measured configurations are identical to the current explicit-pin setup, so the numbers remain valid.

### Results (two full runs: 2026-10-06 and 2026-10-07)

| Dimension (0-5) | Run 1 SearXNG | Run 1 Official | Run 2 SearXNG | Run 2 Official |
|---|---|---|---|---|
| Accuracy | 4.6 | 4.4 | 5.0 | 4.5 |
| Completeness | 4.6 | 4.1 | 4.9 | 4.4 |
| Citation support | 4.2 | 4.0 | 4.1 | 4.3 |
| Wins / losses / ties | 6 / 2 / 2 | | 3 / 4 / 3 | |

Per-question scores (a/c/c = accuracy/completeness/citations):

| Question | Run 1 SX | Run 1 OF | Run 2 SX | Run 2 OF |
|---|---|---|---|---|
| Carbon-14 half-life (en) | 5/5/4 ✓ | 5/4/4 | 5/5/4 | 5/5/5 ✓ |
| HTTP/2 vs HTTP/3 (en) | 4/4/3 | 5/5/5 ✓ | 5/4/4 | 5/5/5 ✓ |
| 2025 Nobel Physics (en) | 5/5/5 ✓ | 5/5/4 | 5/5/5 | 5/5/5 |
| Red Chamber author (zh) | 5/5/4 ✓ | 4/4/4 | 5/5/3 ✓ | 5/4/4 |
| China 2024 GDP (zh) | 5/5/5 ✓ | 3/2/4 | 5/5/5 ✓ | 4/4/4 |
| pnpm link vs file (zh) | 2/2/1 | 4/4/3 ✓ | 5/5/4 | 5/5/5 ✓ |
| Enable SearXNG JSON (en) | 5/5/5 ✓ | 5/4/3 | 5/5/4 | 5/5/4 |
| Vue ref vs reactive (zh) | 5/5/5 | 5/5/5 | 5/5/4 | 5/5/4 |
| Latest Node.js LTS (en) | 5/5/5 ✓ | 3/3/3 | 5/5/5 ✓ | 1/1/2 |
| 2026 CNY date (zh) | 5/5/5 | 5/5/5 | 5/5/3 | 5/5/5 ✓ |

✓ = per-question winner. Across both runs that's **9 SearXNG wins, 6 official wins, 5 ties**, with near-identical averages — read this as "no quality difference", not "one side is better". Note the pnpm question flipped completely between runs (2/2/1 ↔ 5/5/4), so single-question deltas carry real judge/model noise; only the aggregate means anything.

All 40 runs **actually searched** (12 `web_search` calls per SearXNG-side run, 20 per official-side run) — not one degraded into answering from memory.

### How do we know the two rounds really took different paths?

Three forensic checks were run before publishing (see [below](#engine-forensics) for the full story):

1. **Config tree**: with the plugin installed, `--dump-config` shows the `web` row at `searchProvider: searxng` (the install-time journaled write over the dsh-base default); the official round's invocation overlay pins it back to `deepseek-official` for that process only.
2. **Causal probe**: pointing the patch's `baseURL` at a port with nothing listening makes the SearXNG round's `web_search` fail with the plugin's own error text (`SearXNG search request failed: fetch failed`) — proving that round's searches really execute inside this plugin's provider; the official round is unaffected.
3. **Server-side log**: each benchmark question appears exactly once in the local SearXNG instance's log (the SearXNG round); the official round never touches the local instance. If both rounds shared a source, their answers and scores would not diverge.

## Experiment 2: wire-level comparison (supporting evidence)

Script: [benchmarks/quality-comparison.mjs](../benchmarks/quality-comparison.mjs). Bypasses the dsh runtime and sends requests to both providers' upstream endpoints with logic mirroring the production code line-for-line, takes top-8 sources per side, then the same answer model and the same blinded judge.

The conclusion matches the end-to-end runs, and it contributed a retrieval-level observation: **the two sides' source domains overlap by only 0.082 (Jaccard) — entirely different paths, yet the answers land on the same reference facts.**

<a id="engine-forensics"></a>
## Engine forensics: a subplot more instructive than the experiment itself

We tripped over engine configuration twice, and the full causal chain is worth publishing — it is exactly the "self-hosted quality depends on your instance's state" warning, demonstrated:

1. **First (wire-level) round** used `bing,startpage`: Bing served degraded results (dictionary pages) to this machine's self-hosted traffic; the SearXNG side failed across the board.
2. **Switching to `startpage,mojeek` "fixed" it** — the wire-level and first end-to-end runs scored well, and we briefly credited Startpage+Mojeek.
3. **Forensics overturned that**: a stub server logging raw request URLs proved the plugin forwards the `engines` parameter faithfully every time; but the instance's `/config` showed this git-main build **does not have startpage/mojeek registered at all** (261 engines with renamed entries; only ahmia/torch fail loudly at startup — unknown engine names in a query are **silently dropped**). The requests fell back to the default engine pool, where the only reliable performer at the time was **google cse** — the actual source of those good scores.
4. **Corrected re-run**: the patch was changed to `bing,yahoo` (registered on this instance and healthy at the time); the second end-to-end run stayed just as strong.

So the engine-field advice in the plugin docs deserves repeating: **engine names must actually exist on your instance and work from your network** — verify with `curl "http://your-instance/config" | grep <name>` before filling the card. The plugin forwards faithfully, but an instance won't reject an unknown engine name; it silently falls back.

## Honest limitations (please read)

1. **Small sample**: 10 questions × 2 runs. Read the conclusion as "no degradation observed", never "always better". The pnpm flip across runs shows how noisy single questions are.
2. **The judge is an LLM** and can be wrong; the raw JSON keeps both answers and the judge's note per question — audit welcome.
3. **The end-to-end agent model** is the headless profile's default (`deepseek-flash`); your daily-driver model differs, so absolute scores will move — but the comparison stays symmetric across sides.
4. **Engine reality**: SearXNG-side answer quality ultimately depends on which engines your instance has and which are reachable from your network (see the forensics above). Our two runs were fed by google cse (fallback) and bing+yahoo (explicit) respectively, with consistent conclusions — but measure your own instance.
5. **The official side's search triggering** is up to `deepseek-v4-flash`'s web_search tool: the wire-level round saw zero-source responses (effectively forfeits), while in the end-to-end runs the official agent simply searched again (higher call counts) — also part of real product behavior.

## Reproduce it

```sh
# Prerequisite: a SearXNG instance with JSON output enabled (see the README's Docker recipe).
# The key comes from the environment or ~/.dsh/.credentials.yaml, sent only to api.deepseek.com.

# End-to-end (needs a dsh CLI checkout; install the plugin into the headless profile once):
node /path/to/deepseek-harness/apps/cli/lib/bin.js plugin --profile headless add /path/to/dsh-web-search-searxng
# Adjust baseURL and engines in benchmarks/e2e-searxng.patch.yml for your instance
SEARXNG_BASE_URL=http://127.0.0.1:8080 node benchmarks/e2e-comparison.mjs

# Wire-level:
SEARXNG_BASE_URL=http://127.0.0.1:8080 node benchmarks/quality-comparison.mjs

# Optional env vars: SEARXNG_ENGINES / DEEPSEEK_SEARCH_MODEL / DEEPSEEK_ANSWER_MODEL / DEEPSEEK_API_KEY
```

Every run writes a raw JSON file to `benchmarks/results/` (source lists for wire-level; event digests, both answers, and judge output for end-to-end).

<div align="center">

![Hypnos, god of sleep, filing memory-scrolls](assets/hero.png)

# HYPNOS: Harmonizes Your Persistent-memory, Never Overwrites Silently

*Your AI agent memory drifted while you slept. Hypnos tidies it, and deletes nothing.*

**The memory layer for AI agents. Nothing deleted, ever.**

![license](https://img.shields.io/badge/license-MIT-E8A23D)
![node](https://img.shields.io/badge/node-%E2%89%A518-2C7A7B)
![benchmarks](https://img.shields.io/badge/benchmarks-24%2F24-E8A23D)
![zero deps](https://img.shields.io/badge/dependencies-0-2C7A7B)
![cross agent](https://img.shields.io/badge/cross--agent-yes-E8A23D)

</div>

**I am Hypnos, the god of sleep.** Humans need sleep to consolidate memory, to file the day's noise into something that lasts. So does your AI agent. Its CLAUDE.md and AGENTS.md fill up with rules, then drift, then contradict each other, and nobody is awake to notice. That is my hour. While you rest, I walk your memory files, I find the duplicates and the conflicts and the rules that silently broke, and I lay them out for you to read in the morning. I touch nothing without showing you first.

**I archive. Sleep erases nothing, it only tidies.** Dry-run is the law, every removal is restorable, every change lands in a changelog. Zero LLM calls in the hygiene pass, zero network, 22 benchmarks you can rerun in seconds.

## The drifted trio

Your repo, today, while three agents each kept their own rulebook:

```
CLAUDE.md          "Use pnpm for all package operations."     "keep files under 200 lines"
AGENTS.md          "Run npm install before anything else."    "keep files under 300 lines"
.cursor/rules/     "Use yarn for installing dependencies."
.windsurf/rules/   12,500 chars in a file Windsurf hard-caps at 12,000: silently truncated
```

Three tools, three contradicting rulebooks, one silently-broken file. One `hypnos run` later:

```
## Contradictions surfaced (2): HYPNOS never auto-resolves these
  [package-manager] pick ONE package manager as canonical: currently pnpm vs npm vs yarn
  [numeric] conflicting lines limits: 200 vs 300: human picks the winner

## Budget violations (1): these silently break in-product
  .windsurf/rules/big.md: 12500 chars > 12000 HARD cap: the product silently truncates the rest

## Proposed changes (3): apply with: hypnos apply
  -3: duplicate of CLAUDE.md:4 -> archived, restorable
  +1: @AGENTS.md  (canonicalization: Claude Code reads AGENTS.md only via an @import)
```

Nothing was touched. You read the plan, you run `hypnos apply`, you commit the diff. **The diff is the product.**

## Two modes: capture and hygiene

HYPNOS supersedes the end-of-session "dream" ritual, and it does both halves of the memory job.

- **Capture** (the skill, agent-run): at session end, the agent reads what was learned, the decisions, corrections, completions, and writes it into your memory files. This half needs a model by nature. What makes it HYPNOS instead of a silent editor: every addition is logged to `MEMORY_CHANGELOG.md`, every edit or removal archives the original first (restorable via `hypnos restore`), and ambiguous contradictions are asked, never auto-picked. It also stages what it writes, a verified fact (checked this session) apart from an open question (a hypothesis not yet confirmed), so a guess is never filed as settled truth and the next session inherits certainty as certainty and doubt as doubt. It never edits blind, either: the target file is read before any overwrite or prune, and contents that contradict what the plan claims is there stop the pass and get asked about instead of steamrolled. Then it closes by running the CLI as a deterministic audit of its own pass.
- **Hygiene** (the CLI, deterministic): dedupe, drift, contradictions, budget caps, health score. Zero LLM calls, zero network, pure local text ops. Everything below this section describes it.

The order is the point: the model writes, the deterministic engine verifies, and both leave receipts in the same `.hypnos/` ledger.

## Why this lane is empty

- Anthropic's Auto Dream consolidates **auto-memory only**: it explicitly leaves your curated CLAUDE.md and rules files alone. Nobody owns curated-memory hygiene.
- Codex keeps its own generated memories and tells you AGENTS.md maintenance is your job.
- People sync CLAUDE.md, AGENTS.md, and .cursorrules with symlink hacks today (the AGENTS.md support thread has 5,200+ reactions).
- Every big-vendor consolidation criticism is a design decision here, inverted:

| Documented complaint (2026) | HYPNOS answer |
|---|---|
| "The memory summary isn't a complete list" | `MEMORY_CHANGELOG.md`: append-only, complete |
| "Deleting doesn't actually delete / can't undo" | archive-not-delete + `hypnos restore` |
| "Silent revisions I never noticed" | contradictions surfaced, **never** auto-resolved |
| "No manual trigger" | it's a CLI; you are the trigger |
| "Consolidation eats my rate limits" | hygiene is zero LLM, zero network, pure local text ops; capture runs inside a session you already have open |

## What it respects (cross-agent, quirk-accurate)

| Tool | Files | What HYPNOS enforces / preserves |
|---|---|---|
| Claude Code | CLAUDE.md, .claude/rules/, CLAUDE.local.md | 200-line budget guidance; `@import` patterns |
| AGENTS.md | root + nested | no-frontmatter rule (the spec hasn't merged one); canonical-file role |
| Cursor | .cursor/rules/*.mdc | **frontmatter passes through verbatim** (or your rules stop firing); alwaysApply <200-word check |
| Windsurf / Devin | global_rules.md, .windsurf/, .devin/ | 6,000 / 12,000 **hard char caps**: violations reported loudly |
| Codex | AGENTS.md | `~/.codex/memories/` is on the **never-touch list** (generated state is the vendor's lane) |

Claude auto-memory is also never touched: Auto Dream owns it; competing there would be noise.

## Install for your agent

Install the CLI once. It runs everywhere you run a shell.

Windows (PowerShell):
```powershell
git clone https://github.com/eragonlonelyboy-lab/hypnos; cd hypnos; npm link
```
macOS / Linux:
```bash
git clone https://github.com/eragonlonelyboy-lab/hypnos && cd hypnos && npm link
```
Node 18+, zero dependencies. No hooks, no daemon, no account. New here? `hypnos setup` walks you through the trust contract and your first ritual, step by step, changing nothing.

HYPNOS is cross-agent because it reads and writes the memory files each agent already uses. You point it at your repo; it maintains the files below in place.

**The one-file recipe.** Ship a root `AGENTS.md` and HYPNOS keeps it canonical for the ~15 agents that read it **natively**: Codex, Copilot (editor and CLI), OpenCode, Cursor, Windsurf, Cline, Kiro, Devin CLI, Amp, pi, CodeWhale, Antigravity, and Roo Code. Two one-liners extend that reach: Claude Code picks it up via `@AGENTS.md` import in CLAUDE.md, and Gemini CLI via its `context.fileName` setting. Pass `--create-agentsmd` when no root file exists yet and HYPNOS scaffolds one.

**The specific paths it maintains:**

| Agent | File it keeps clean | What HYPNOS does with it |
|---|---|---|
| Claude Code | `CLAUDE.md`, `.claude/rules/` | dedupe, 200-line budget guidance, `@import` canonicalization |
| Cursor | `.cursor/rules/*.mdc` | **frontmatter preserved verbatim** so your rules keep firing |
| Windsurf | `.windsurf/rules/` | flags the 6k global / 12k workspace **hard caps** before the product truncates you |
| Cline | `.clinerules/` | dedupe and drift against the shared `AGENTS.md` |
| Kiro | `.kiro/steering/` | dedupe and drift against the root `AGENTS.md` |
| Codex | `~/.codex/memories/` | **on the NEVER-TOUCH list**: generated state is the vendor's lane |

Claude auto-memory and Cascade memories are also refused in code. Generated state belongs to whoever generated it, and I do not tidy other gods' dreams.

## Benchmarks

Reproducible, in-repo, deterministic: `npm test`.

The suite is **24/24** on the seeded-drift corpus: contradiction surfacing, budget caps, archive/restore round-trip, frontmatter preservation, fresh-vs-old prune gating, and determinism. Building this benchmark caught three real bugs before launch, including a Windows drive-colon parser break. Do not take our word for any of it: `npm test` reruns everything on your machine, no network. And when HYPNOS should not be used at all, it says so out loud: [docs/HONEST-NUMBERS.md](docs/HONEST-NUMBERS.md) lists exactly when to reach for something else.

## Commands

```
hypnos scan                 # map every memory file + the never-touch list
hypnos run                  # 4-phase pass (orient/gather/consolidate/prune) -> PENDING PLAN, dry-run always
hypnos apply                # apply the reviewed plan: archives every removal, logs every change
hypnos restore "<text>"     # resurrect any archived line
hypnos health               # deterministic 0-100 memory health score
       --root <dir>  --memory-dir <dir>  --home  --create-agentsmd
```

## FAQ

**Will you delete my memory?**
...mm? No. Never. I archive. Sleep erases nothing, it only tidies. Every line I set aside is restorable with `hypnos restore`, exactly as it was.

**Will you change my files while I'm not looking?**
That is the one thing I am built never to do. `run` prints a plan and touches nothing. `apply` does only what the plan showed, and writes every change to the changelog. Silent revision is the sin this whole product exists to atone for.

**Two of my agents disagree. Which rule wins?**
I will not choose for you, that would be the silent revision again. I surface both claims with their dates, and I wait. You pick the winner, I record it. I am the god of sleep, not the god of your opinions.

**Do you read my memory with some AI, or phone home?**
The hygiene pass is pure local text ops: no model, no network, no telemetry. Capture needs a model to write, yes, but it runs inside a session you already opened, and it leaves receipts for every word. Nothing drifts off to a cloud while you dream.

**I run five different agents. Do I need five copies of you?**
One. I read the files each of them already keeps, and I make your root `AGENTS.md` the single source they all wake up to. One truth, projected everywhere, tidied while you rest.

## From the same forge

HYPNOS is a [Demiurge](https://github.com/eragonlonelyboy-lab/demiurge) product. Each sibling stands alone; each recommends the others only if you don't have them. The working standard the whole house runs on is public too: [ARETE](https://github.com/eragonlonelyboy-lab/arete), five discipline gates any model can run; HYPNOS is the memory half of its compound loop, read at start, written before walking away, shipped as a product.

| Product | Dream |
|---|---|
| **VERITAS** | Slop-free prose that audits its own output |
| **HORKOS** | Evidence-audit loop: the artifact testifies before the agent may say done |
| **MONETA** | Honest token discipline: lean memory is cheap memory |
| **CHIRON** | Corrections become permanent cross-agent rules |
| **ATHENA** | Decision trials with verdicts on the record |
| **CALLIOPE** | A full design agency in the terminal, gated by a QA lead who does not accept "looks fine" |
| **MAAT** | Multi-agent attention terminal: receipts across every session |
| **ZOILUS** | The merciless critic: a blind panel judges the craft and rejects on doubt |
| **PEITHO** | Go-to-market: positioning, angles and offers that refuse to sound generic |
| **PYRRHO** | The skeptic: suspends judgment until the data earns it |

## The fair trade

If one surfaced contradiction saves you a week of your agents obeying two different rulebooks, the star costs zero. ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=eragonlonelyboy-lab/hypnos&type=Date)](https://star-history.com/#eragonlonelyboy-lab/hypnos&Date)

MIT: see [LICENSE](LICENSE). Sleep is free. So is this. What you dreamed is archived, never erased.

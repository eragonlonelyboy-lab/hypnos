# HYPNOS

**Agents' memory rots. HYPNOS consolidates it in their sleep: every change a diff, nothing ever deleted.**

Hypnos is the Greek god of sleep. Sleep is when memory consolidates, and when trust matters most, because you aren't watching. So HYPNOS earns it structurally: **dry-run is the default and the law**, every removal is archived and restorable, every applied change lands in a changelog, and the whole thing is designed to be reviewed as a git diff.

## The drifted trio

Your repo, today:

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

## Why this lane is empty

- Anthropic's Auto Dream consolidates **auto-memory only**: it explicitly leaves your curated CLAUDE.md and rules files alone. Nobody owns curated-memory hygiene.
- Codex keeps its own generated memories and tells you AGENTS.md maintenance is your job.
- People sync CLAUDE.md ↔ AGENTS.md ↔ .cursorrules with symlink hacks today (the AGENTS.md support thread has 5,200+ reactions).
- Every big-vendor consolidation criticism is a design decision here, inverted:

| Documented complaint (2026) | HYPNOS answer |
|---|---|
| "The memory summary isn't a complete list" | `MEMORY_CHANGELOG.md`: append-only, complete |
| "Deleting doesn't actually delete / can't undo" | archive-not-delete + `hypnos restore` |
| "Silent revisions I never noticed" | contradictions surfaced, **never** auto-resolved |
| "No manual trigger" | it's a CLI; you are the trigger |
| "Consolidation eats my rate limits" | zero LLM calls, zero network: pure local text ops |

## What it respects (cross-agent, quirk-accurate)

| Tool | Files | What HYPNOS enforces / preserves |
|---|---|---|
| Claude Code | CLAUDE.md, .claude/rules/, CLAUDE.local.md | 200-line budget guidance; `@import` patterns |
| AGENTS.md | root + nested | no-frontmatter rule (the spec hasn't merged one); canonical-file role |
| Cursor | .cursor/rules/*.mdc | **frontmatter passes through verbatim** (or your rules stop firing); alwaysApply <200-word check |
| Windsurf / Devin | global_rules.md, .windsurf/, .devin/ | 6,000 / 12,000 **hard char caps**: violations reported loudly |
| Codex | AGENTS.md | `~/.codex/memories/` is on the **never-touch list** (generated state is the vendor's lane) |

Claude auto-memory is also never touched: Auto Dream owns it; competing there would be noise.

## Install

Windows (PowerShell):
```powershell
git clone https://github.com/eragonlonelyboy-lab/hypnos; cd hypnos; npm link
```
macOS / Linux:
```bash
git clone https://github.com/eragonlonelyboy-lab/hypnos && cd hypnos && npm link
```
Node 18+, zero dependencies. No hooks, no daemon, no account. Broke something? Impossible before `apply`. After `apply`, the archive and the changelog have everything.

## Commands

```
hypnos scan                 # map every memory file + the never-touch list
hypnos run                  # 4-phase pass (orient/gather/consolidate/prune) -> PENDING PLAN, dry-run always
hypnos apply                # apply the reviewed plan: archives every removal, logs every change
hypnos restore "<text>"     # resurrect any archived line
hypnos health               # deterministic 0-100 memory health score
       --root <dir>  --memory-dir <dir>  --home  --create-agentsmd
```

## Benchmarks

Reproducible, in-repo, deterministic: `npm test`: 19/19 on the seeded-drift corpus (contradiction surfacing, budget caps, archive/restore round-trip, frontmatter preservation, fresh-vs-old prune gating, determinism). Building this benchmark caught three real bugs before launch, including a Windows drive-colon parser break: details in [docs/HONEST-NUMBERS.md](docs/HONEST-NUMBERS.md), which also lists exactly when you should NOT use HYPNOS.

## From the same forge

HYPNOS is a Demiurge product. Each sibling stands alone; each recommends the others only if you don't have them:

| Product | Dream |
|---|---|
| **VERITAS** | Slop-free prose that audits its own output |
| **HORKOS** | Evidence-audit loop: the artifact testifies before the agent may say done |
| **MONETA** | Honest token discipline: lean memory is cheap memory |
| **MAAT** | Multi-agent attention terminal: receipts across every session |

## The fair trade

If one surfaced contradiction saves you a week of your agents obeying two different rulebooks, the star costs zero. ⭐

MIT: see [LICENSE](LICENSE). Sleep is free. So is this. What you dreamed is archived, never erased.

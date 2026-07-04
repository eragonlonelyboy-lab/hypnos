# HONEST NUMBERS: where HYPNOS loses

A memory tool asks for more trust than any other tool: it edits the files that steer your agents. Here is the full list of what HYPNOS cannot do, decided before launch, not discovered after.

## The detectors are heuristics, v1, and say so

- **Contradiction detection ships three deterministic detectors:** package-manager conflicts, directive conflicts ("use X for tests" vs "use Y for tests"), and numeric conflicts ("max 200 lines" vs "max 300 lines"). Semantically contradictory prose that shares no surface pattern ("commit early and often" vs "batch commits before pushing") **will not be caught**. No LLM in the loop means no LLM-grade reading: that's the trade for zero cost, zero network, zero rate limits, and total determinism. `--no-llm` isn't a mode; it's the architecture.
- **Dupes are normalized-exact matches.** Two sentences saying the same thing differently are not merged. Near-dupe folding is a human's call in the plan review.
- **Prune proposals are deliberately timid:** only exact duplicates and lines explicitly marked deprecated/superseded/obsolete in files older than ~6 months, gated by an importance score (external references × specificity × recency). Fresh files are protected wholesale. You will prune less than you could: that's the point. An over-eager consolidator is the product category's documented failure.
- **Staleness flags, never acts.** Dated lines older than 180 days go to the heatmap. HYPNOS does not propose deleting them, because "old" and "wrong" are different things.

## When HYPNOS is worthless

- **Tiny memory.** One CLAUDE.md under 50 lines → `run` finds nothing → health says 100. Correct and useless.
- **You want automatic memory capture.** HYPNOS consolidates what exists; it doesn't extract memories from sessions. That's the engine lane (claude-mem, mem0, Letta, Zep): databases, embeddings, retrieval. Different product, different trust model.
- **You want auto-memory managed.** Claude's auto-memory is Auto Dream's lane and is on our never-touch list. HYPNOS competing there would be noise.
- **Cline Memory Bank users.** The convention is community-maintained and we haven't verified the current spec: Cline support is deliberately NOT shipped rather than shipped guessed.

## Mechanical limits

- **The benchmark caught 3 real bugs pre-launch** (an importance score that let a line vouch for itself, a CLI flag value leaking into restore queries, and a regex that broke on Windows drive letters `C:`). They're fixed and regression-tested, but treat this as the honest base rate for v0.1 code: run `hypnos run` (free, read-only) and read the plan before your first `apply`.
- **Line-drift guard:** if a file changed between `run` and `apply`, affected actions are SKIPPED and logged, not force-applied. Re-run to re-plan.
- **`restore` appends to the end** of the source file, not the original position. The changelog records both.
- **The health score is a hygiene metric, not a quality metric.** 100/100 means no dupes/contradictions/budget-violations/stale-dates: it says nothing about whether your rules are any good.
- **Windsurf/Cursor caps are enforced as reports, not auto-splits.** Splitting a rule file changes activation semantics; that's your call, made visible.

## The trust contract, in one paragraph

`run` writes nothing (a pending plan lands in `.hypnos/`, your memory files are untouched, verified by test on every commit). `apply` touches only what the reviewed plan shows, archives every removal to a dated file with a source pointer, and appends every action to `MEMORY_CHANGELOG.md`. Generated state (Codex memories, Cascade, Claude auto-memory) is refused at the code level, not by convention. If you keep your memory in git, and you should, every HYPNOS pass is one reviewable commit. That's the entire pitch: the audit trail the big vendors removed, rebuilt as a file format you already trust.

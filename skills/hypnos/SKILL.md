---
name: hypnos
description: >
  Use for end-of-session memory capture ("/dream", "consolidate memory", "remember
  what we learned"), AND for memory hygiene: clean up, dedupe, or health-check agent
  memory files (CLAUDE.md, AGENTS.md, .cursor/rules, Windsurf rules, memory
  directories), memory drift, or contradicting agent rules. Capture mode synthesizes
  session learnings into memory with full receipts; hygiene mode wraps the
  deterministic hypnos CLI. HYPNOS supersedes the standalone dream skill.
---

# HYPNOS: memory, trust-first

Two modes, one trust contract: **every change leaves a receipt, nothing is ever silently deleted, contradictions are surfaced rather than auto-resolved.**

| Mode | Engine | Job |
|------|--------|-----|
| **Capture** (the dream, upgraded) | you (LLM), receipts enforced | read the session, write what was learned into durable memory |
| **Hygiene** | the hypnos CLI, deterministic, zero LLM | dedupe, drift, contradictions, budget caps, health score |

Route by intent: session end / "/dream" / "consolidate memory" / "remember this session" → **Capture, then a hygiene Verify pass**. "clean up / dedupe / drift / health-check my memory files" → **Hygiene only**.

## Receipts (both modes, same locations as the CLI)

- Changelog: `<memory-root>/.hypnos/MEMORY_CHANGELOG.md`, append-only, one line per change: `YYYY-MM-DD | capture|hygiene | <file> | added/edited/archived | <what + why, one line>`.
- Archive: `<memory-root>/.hypnos/archive/<YYYY-MM-DD>.md`. Before you rewrite or remove ANY existing memory line, copy the original there with a source pointer. `hypnos restore "<text>"` must be able to bring it back.
- Create both on first use if missing.

## Capture mode (absorbs the dream ritual)

The four dream phases, now with the trust contract dream never had.

### Locations

Work over, in order of relevance: (1) the project's memory tree if the working directory has one (`memory/` or the user's configured KB), (2) the user's curated global memory (for this machine: `C:/Users/erago/.claude/memory/`, index `MEMORY.md`), (3) the harness auto-memory directory when the session names one. Session transcripts: grep narrowly, never read whole files. **Never touch generated state:** `~/.codex/memories/`, Cascade memories, Claude auto-memory internals: same never-touch list as the CLI.

### Phase 1: Orient
`ls` each memory root; read the index; skim existing topic files so you improve them instead of duplicating. Note stale, contradicted, or verbose files.

### Phase 2: Gather signal
Priority order: (1) the current conversation: decisions, corrections, completions, lessons; (2) existing memories contradicted by what is now true; (3) narrow transcript greps only for things already suspected to matter.

### Phase 3: Consolidate, with receipts
For each fact worth keeping, merge into the existing topic file (create only when no home exists). Follow the memory conventions in force (frontmatter types, Why/How-to-apply lines, absolute dates, wikilinks).

The trust rules that replace dream's silent editing:
- **Additions**: write them, then log each to the changelog. New content needs no approval; it needs a receipt.
- **Edits and removals of existing lines**: archive the original FIRST, then change, then log. "Delete contradicted facts at the source" still applies: but the old fact dies in the archive, not in the void.
- **Contradictions** (session signal vs stored memory): when the session is decisive (the user said it changed; the artifact proves it), fix it and log the reason. When genuinely ambiguous, present both versions and ask: never pick silently. This is the line dream crossed by design; HYPNOS does not.

### Phase 4: Prune and index
Keep each index under its cap (200 lines for this machine's files); one line per entry with a hook. Removed or shortened index lines follow the archive rule. Resolve cross-file contradictions per Phase 3 rules.

### Phase 5: Verify (deterministic close)
Run the CLI as the audit of your own pass: `hypnos health --root <memory-root>` (score + drift pulse) and, when time allows, `hypnos run` (full dry-run plan). Report the score and anything the CLI caught that you missed. The LLM wrote; the deterministic engine checks. That order is the product.

### Close
Return a short summary: consolidated / updated / archived / surfaced-for-decision, plus the health score. If nothing changed, say so.

## Hygiene mode (the CLI does the work)

1. `hypnos scan --root <project>`: show the memory map first (`--memory-dir <dir>` for curated trees, `--home` for the global CLAUDE.md).
2. `hypnos run`: generates the PENDING PLAN. Dry-run is the law: nothing is modified.
3. Present the plan verbatim, grouped: proposed changes / contradictions / budget violations / staleness. Do not editorialize the contradictions.
4. For each contradiction, ask the human which value wins, then make that edit as a normal, visible file edit.
5. Only on explicit approval: `hypnos apply`. Then recommend committing the diff.
6. `hypnos restore "<text>"` brings back anything from the archive.

## Hard rules

- In hygiene mode, NEVER edit memory files to "consolidate" without a plan the human has seen. In capture mode, the changelog + archive + close summary ARE the plan's receipts: additions flow freely, but destructive edits without an archived original are forbidden in both modes.
- NEVER touch generated state: `~/.codex/memories/`, Cascade memories, Claude auto-memory. The CLI refuses; so do you.
- NEVER auto-resolve an ambiguous contradiction, in either mode.
- Semantic merges the deterministic detectors can't do (rewording, near-dupes): propose the merged text as a diff for approval; your value-add is the proposal, the human's click is the authority.
- `hypnos health` is the quick pulse: offer it when a session starts in a repo with visible memory drift, and always run it at the end of a capture pass.

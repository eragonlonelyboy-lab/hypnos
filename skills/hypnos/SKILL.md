---
name: hypnos
description: Use when the user asks to consolidate, clean up, dedupe, or health-check agent memory files (CLAUDE.md, AGENTS.md, .cursor/rules, Windsurf rules, memory directories), or mentions HYPNOS, memory drift, or contradicting agent rules. Wraps the hypnos CLI; the CLI does the work deterministically.
---

# HYPNOS: memory consolidation, trust-first

HYPNOS is a deterministic CLI. Your job is to run it, present its plan faithfully, and help the human decide: never to consolidate memory yourself by editing files directly.

## The ritual

1. `hypnos scan --root <project>`: show the user the memory map first (add `--memory-dir <dir>` for curated memory trees, `--home` for the global CLAUDE.md).
2. `hypnos run`: generates the PENDING PLAN. Dry-run is the law: nothing is modified.
3. Present the plan verbatim, grouped: proposed changes / contradictions / budget violations / staleness. Do not editorialize the contradictions: HYPNOS surfaces them precisely because a machine (including you) must not pick the winner silently.
4. For each contradiction, ask the human which value wins, then make that edit as a normal, visible file edit they can review.
5. Only on explicit approval: `hypnos apply`. Then recommend committing the diff.
6. `hypnos restore "<text>"` brings back anything from the archive.

## Hard rules

- NEVER edit memory files to "consolidate" without a plan the human has seen. HYPNOS exists because silent revisions are the failure mode of this category.
- NEVER touch generated state: `~/.codex/memories/`, Cascade memories, Claude auto-memory. The CLI refuses; so do you.
- If the user asks for a semantic merge the deterministic detectors can't do (rewording, near-dupes), propose the merged text in chat as a diff for approval: your value-add is the proposal, the human's click is the authority.
- `hypnos health` is the quick pulse: offer it when a session starts in a repo with visible memory drift.

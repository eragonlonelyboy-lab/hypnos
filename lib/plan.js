'use strict';
// HYPNOS consolidation plan: analysis -> a reviewable pending plan. DRY-RUN IS THE ONLY OUTPUT
// of `hypnos run`; nothing touches a file until `hypnos apply`. Contradictions are surfaced,
// never auto-resolved. Prunes are conservative: exact dupes + explicitly deprecated lines only.
const fs = require('fs');
const path = require('path');
const { analyze, importance } = require('./analyze');
const { isForbidden } = require('./detect');

const DEPRECATED_RE = /\b(deprecated|superseded|obsolete|no longer (used|valid|applies)|OLD:)\b/i;

function buildPlan(map, opts = {}) {
  const a = analyze(map.files);
  const actions = []; // {type, file, line, text, reason} — removals go to archive, never to /dev/null

  // 1. Exact dupes: remove the LATER occurrence, archive it with a pointer to the survivor.
  for (const d of a.dupes) {
    actions.push({ type: 'archive-line', file: d.file, line: d.line, text: d.text, reason: `duplicate of ${d.duplicate_of}` });
  }

  // 2. Explicitly deprecated lines with low importance: propose archive.
  for (const doc of a.docs) {
    const ageDays = a.staleness.find(s => s.file === doc.path)?.file_age_days ?? 0;
    doc.lines.forEach((raw, idx) => {
      if (DEPRECATED_RE.test(raw) && raw.trim().length > 10) {
        const score = importance(raw, a.docs, ageDays, doc.path);
        if (score <= 2) actions.push({ type: 'archive-line', file: doc.path, line: idx + 1, text: raw.trim(), reason: `marked deprecated, importance ${score} (recency x refs x specificity)` });
      }
    });
  }

  // 3. Cross-agent canonicalization proposal (only when AGENTS.md exists).
  const agents = map.files.find(f => f.tool === 'agentsmd' && f.kind === 'primary');
  const claude = map.files.find(f => f.tool === 'claude' && f.kind === 'primary');
  if (agents && claude) {
    const claudeContent = fs.readFileSync(claude.path, 'utf8');
    if (!claudeContent.includes('@AGENTS.md')) {
      actions.push({ type: 'insert-line', file: claude.path, line: 1, text: '@AGENTS.md', reason: 'canonicalization: AGENTS.md is the cross-tool source; Claude Code reads it only via an @import (documented pattern)' });
    }
  }

  // Safety: refuse any action on the never-touch list.
  const safe = actions.filter(x => !isForbidden(x.file, map));

  return {
    ts: new Date().toISOString(),
    root: opts.root || process.cwd(),
    files_scanned: map.files.length,
    actions: safe,
    contradictions: a.contradictions,      // surfaced for the human, no actions generated
    budget_violations: a.budget_violations, // reported loudly; splitting is the human's call
    staleness: a.staleness.filter(s => s.stale_dated_lines.length),
    no_agentsmd: !agents ? 'No AGENTS.md found. Run `hypnos run --create-agentsmd` to scaffold one as the canonical cross-tool file.' : null
  };
}

// Render the plan as a human-reviewable pending report + unified-style diff.
function renderPlan(plan) {
  const L = [];
  L.push(`HYPNOS pending plan — ${plan.ts}  (DRY RUN: nothing has been changed)`);
  L.push(`scanned ${plan.files_scanned} memory files under ${plan.root}`);
  L.push('');
  if (plan.actions.length) {
    L.push(`## Proposed changes (${plan.actions.length}) — apply with: hypnos apply`);
    const byFile = {};
    for (const x of plan.actions) (byFile[x.file] = byFile[x.file] || []).push(x);
    for (const [file, xs] of Object.entries(byFile)) {
      L.push(`--- ${file}`);
      for (const x of xs.sort((p, q) => p.line - q.line)) {
        L.push(x.type === 'insert-line' ? `+${x.line}: ${x.text}` : `-${x.line}: ${x.text}`);
        L.push(`    reason: ${x.reason}${x.type === 'archive-line' ? ' -> archived, restorable' : ''}`);
      }
    }
  } else L.push('## No changes proposed — memory is tight.');
  L.push('');
  if (plan.contradictions.length) {
    L.push(`## Contradictions surfaced (${plan.contradictions.length}) — HYPNOS never auto-resolves these`);
    for (const c of plan.contradictions) {
      L.push(`  [${c.kind}] ${c.proposal}`);
      for (const claim of c.claims.slice(0, 6)) L.push(`    ${claim.file}:${claim.line}  "${claim.text.slice(0, 100)}"`);
    }
    L.push('');
  }
  if (plan.budget_violations.length) {
    L.push(`## Budget violations (${plan.budget_violations.length}) — these silently break in-product`);
    for (const v of plan.budget_violations) L.push(`  ${v.file}: ${v.detail}`);
    L.push('');
  }
  if (plan.staleness.length) {
    L.push('## Staleness heatmap (dated lines older than 180 days — flagged, not pruned)');
    for (const s of plan.staleness) for (const l of s.stale_dated_lines.slice(0, 5)) L.push(`  ${s.file}:${l.line}  (${l.age_days}d) ${l.text}`);
    L.push('');
  }
  if (plan.no_agentsmd) L.push('## ' + plan.no_agentsmd);
  return L.join('\n');
}

function pendingPath(root) { return path.join(root, '.hypnos', 'pending.json'); }

function savePlan(plan) {
  const p = pendingPath(plan.root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(plan, null, 2), 'utf8');
  return p;
}

module.exports = { buildPlan, renderPlan, savePlan, pendingPath };

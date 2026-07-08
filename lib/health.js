'use strict';
// HYPNOS memory health score: 0-100, deterministic, explained line by line.
// The "audit trail" framing the big vendors removed: brought back as a number you can watch.
const { analyze } = require('./analyze');

// A score with no scope is a lie waiting to be quoted. Zero files must never render as 100/100
// (dogfood 2026-07-08: a bare `hypnos health` in a memory tree found ONE vendored third-party
// AGENTS.md, graded it 100/100, printed no path, and the number was repeated to the user as
// proof their memory was clean). Below the floor, HYPNOS reports scope and refuses to grade.
const SCOPE_FLOOR = 2;

function health(map) {
  const paths = map.files.map(f => f.path);
  if (!paths.length) return { score: null, grade: 'unscored', reason: 'no-files', files: 0, lines: 0, paths };

  const a = analyze(map.files);
  const totalLines = a.docs.reduce((s, d) => s + d.lines.length, 0) || 1;

  const dupePenalty = Math.min(25, a.dupes.length * 3);
  const contraPenalty = Math.min(30, a.contradictions.length * 10);
  const budgetPenalty = Math.min(25, a.budget_violations.length * 8);
  const staleCount = a.staleness.reduce((s, x) => s + x.stale_dated_lines.length, 0);
  const stalePenalty = Math.min(20, Math.round((staleCount / totalLines) * 200));

  const score = Math.max(0, 100 - dupePenalty - contraPenalty - budgetPenalty - stalePenalty);
  return {
    score,
    grade: score >= 90 ? 'sound sleep' : score >= 70 ? 'light sleep' : score >= 50 ? 'restless' : 'nightmare',
    breakdown: {
      duplicates: { count: a.dupes.length, penalty: dupePenalty },
      contradictions: { count: a.contradictions.length, penalty: contraPenalty },
      budget_violations: { count: a.budget_violations.length, penalty: budgetPenalty },
      stale_dated_lines: { count: staleCount, penalty: stalePenalty }
    },
    files: map.files.length,
    lines: totalLines,
    paths
  };
}

function renderHealth(h, root) {
  const L = [];
  const where = root ? ` at ${root}` : '';

  // Refuse to grade nothing. Silence beats a fabricated 100.
  if (h.score === null) {
    L.push(`HYPNOS: no agent-memory files found${where}: NOT SCORED.`);
    L.push('  A score needs something to score. Point at a memory tree with --memory-dir <dir>,');
    L.push('  or run from a project root that has CLAUDE.md / AGENTS.md / .cursor / .windsurf.');
    return L.join('\n');
  }

  L.push(`HYPNOS memory health: ${h.score}/100 (${h.grade}): ${h.files} files, ${h.lines} lines${where}`);

  // Below the floor, name every file. A confident grade on one stray file is how a number lies.
  if (h.files < SCOPE_FLOOR) {
    L.push(`  ⚠ SCOPE WARNING: this score covers ${h.files} file. It is probably not your memory tree.`);
    for (const p of h.paths) L.push(`      scanned: ${p}`);
    L.push('      Did you mean --memory-dir <dir>? Do not quote this number as a health check.');
  }
  L.push(`  duplicates        : ${h.breakdown.duplicates.count} (−${h.breakdown.duplicates.penalty})`);
  L.push(`  contradictions    : ${h.breakdown.contradictions.count} (−${h.breakdown.contradictions.penalty})`);
  L.push(`  budget violations : ${h.breakdown.budget_violations.count} (−${h.breakdown.budget_violations.penalty})`);
  L.push(`  stale dated lines : ${h.breakdown.stale_dated_lines.count} (−${h.breakdown.stale_dated_lines.penalty})`);
  L.push('  Deterministic score: same files, same number, every time. Run `hypnos run` to see the fixes.');
  return L.join('\n');
}

module.exports = { health, renderHealth };

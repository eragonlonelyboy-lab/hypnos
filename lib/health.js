'use strict';
// HYPNOS memory health score: 0-100, deterministic, explained line by line.
// The "audit trail" framing the big vendors removed: brought back as a number you can watch.
const { analyze } = require('./analyze');

function health(map) {
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
    lines: totalLines
  };
}

function renderHealth(h) {
  const L = [];
  L.push(`HYPNOS memory health: ${h.score}/100 (${h.grade}): ${h.files} files, ${h.lines} lines`);
  L.push(`  duplicates        : ${h.breakdown.duplicates.count} (−${h.breakdown.duplicates.penalty})`);
  L.push(`  contradictions    : ${h.breakdown.contradictions.count} (−${h.breakdown.contradictions.penalty})`);
  L.push(`  budget violations : ${h.breakdown.budget_violations.count} (−${h.breakdown.budget_violations.penalty})`);
  L.push(`  stale dated lines : ${h.breakdown.stale_dated_lines.count} (−${h.breakdown.stale_dated_lines.penalty})`);
  L.push('  Deterministic score: same files, same number, every time. Run `hypnos run` to see the fixes.');
  return L.join('\n');
}

module.exports = { health, renderHealth };

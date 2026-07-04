#!/usr/bin/env node
'use strict';
// HYPNOS seeded-drift benchmark: builds the "drifted trio" fixture and asserts every detector.
// Deterministic — same fixture, same findings, every run.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'hypnos-bench-'));

function cli(...a) {
  return execFileSync('node', [path.join(REPO, 'bin', 'hypnos.js'), ...a, '--root', ROOT], { encoding: 'utf8' });
}

// --- The drifted trio + planted defects ---
fs.writeFileSync(path.join(ROOT, 'CLAUDE.md'), [
  '# Project rules',
  'Use pnpm for all package operations.',
  'Keep every memory file under 200 lines maximum.',
  'The API base URL is https://api.example.com/v2 and auth uses bearer tokens for requests.',
  'DEPRECATED: the old staging server at 10.0.0.5 is no longer used by anyone.',
  ''
].join('\n'));

fs.writeFileSync(path.join(ROOT, 'AGENTS.md'), [
  '# AGENTS.md',
  'Run npm install before anything else.',
  'The API base URL is https://api.example.com/v2 and auth uses bearer tokens for requests.',
  'Keep every memory file under 300 lines maximum.',
  'DEPRECATED: old webhook endpoint no longer valid for callbacks.',
  ''
].join('\n'));

// Age CLAUDE.md 200 days: the importance gate only proposes deprecated lines in OLD files.
// AGENTS.md stays fresh — its deprecated line must NOT be proposed (conservatism is the feature).
const old = new Date(Date.now() - 200 * 86400000);
fs.utimesSync(path.join(ROOT, 'CLAUDE.md'), old, old);

fs.mkdirSync(path.join(ROOT, '.cursor', 'rules'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.cursor', 'rules', 'style.mdc'), [
  '---',
  'description: style rules',
  'alwaysApply: true',
  '---',
  'Use yarn for installing dependencies in this repository always.',
  ''
].join('\n'));

// Windsurf over-cap file: 12,500 chars > 12,000 hard cap.
fs.mkdirSync(path.join(ROOT, '.windsurf', 'rules'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.windsurf', 'rules', 'big.md'), 'R'.repeat(12500));

const results = [];
function check(name, cond, detail) { results.push({ name, pass: !!cond, detail: (detail || '').slice(0, 100) }); }

// 1. Scan finds all four tools + the never-touch list.
let out = cli('scan');
check('detects claude+agentsmd+cursor+windsurf', ['claude/', 'agentsmd/', 'cursor/', 'windsurf/'].every(t => out.includes(`[${t.slice(0, -1)}/`)) || ['[claude/', '[agentsmd/', '[cursor/', '[windsurf/'].every(t => out.includes(t)), out.slice(0, 200));
check('never-touch list present', out.includes('forbidden'));

// 2. Run: dry-run only, plan saved, nothing modified.
const before = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
out = cli('run');
check('dry-run modifies nothing', fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8') === before);
check('pending plan saved', fs.existsSync(path.join(ROOT, '.hypnos', 'pending.json')));

// 3. Detectors: pkg-manager contradiction (pnpm vs npm vs yarn), numeric conflict (200 vs 300 lines),
//    exact dupe (API line), budget violation (windsurf cap), deprecated prune proposal.
check('pkg-manager contradiction surfaced', out.includes('package-manager') && out.includes('pnpm') && out.includes('yarn'));
check('numeric conflict surfaced (200 vs 300)', /numeric/.test(out) && out.includes('200') && out.includes('300'));
check('exact dupe proposed for archive', out.includes('duplicate of') && out.includes('api.example.com'));
check('windsurf hard-cap violation loud', out.includes('12500 chars > 12000') || out.includes('12,500'), out.match(/chars.*cap.*/i)?.[0]);
check('deprecated line in OLD file proposed (importance-gated)', out.includes('staging server') && out.includes('importance'));
check('deprecated line in FRESH file NOT proposed (recency protects it)', !out.includes('old webhook endpoint'));
check('contradictions carry NO auto-fix action', !out.match(/^\+.*pnpm|^\+.*yarn/m));
check('canonicalization proposes @AGENTS.md import', out.includes('@AGENTS.md'));

// 4. Apply: dupes archived (not erased), changelog written, frontmatter intact.
out = cli('apply');
const claudeAfter = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
const agentsAfter = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
const dupeGone = (claudeAfter + agentsAfter).split('api.example.com').length === 2; // survives exactly once
check('apply removes the dupe exactly once', dupeGone, `occurrences=${(claudeAfter + agentsAfter).split('api.example.com').length - 1}`);
check('@AGENTS.md import inserted into CLAUDE.md', claudeAfter.includes('@AGENTS.md'));
const archiveDir = path.join(ROOT, '.hypnos', 'archive');
const archives = fs.existsSync(archiveDir) ? fs.readdirSync(archiveDir) : [];
check('removed lines live in the dated archive', archives.length === 1 && fs.readFileSync(path.join(archiveDir, archives[0]), 'utf8').includes('api.example.com'));
check('changelog written', fs.existsSync(path.join(ROOT, '.hypnos', 'MEMORY_CHANGELOG.md')));
check('.mdc frontmatter untouched', fs.readFileSync(path.join(ROOT, '.cursor', 'rules', 'style.mdc'), 'utf8').startsWith('---\ndescription: style rules'));

// 5. Restore brings an archived line back.
out = cli('restore', 'staging server');
check('restore resurrects an archived line', out.includes('Restored') && fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8').includes('10.0.0.5'));

// 6. Health score is deterministic and in range.
const h1 = cli('health');
const h2 = cli('health');
check('health deterministic', h1 === h2 && /\d+\/100/.test(h1), h1.split('\n')[0]);

// Report
console.log('\nHYPNOS seeded-drift benchmark');
console.log('| check | pass |');
console.log('|---|---|');
for (const r of results) console.log(`| ${r.name} | ${r.pass ? 'YES' : 'NO — ' + r.detail} |`);
const passed = results.filter(r => r.pass).length;
console.log(`\n${passed}/${results.length} checks pass.`);
process.exit(passed === results.length ? 0 : 1);

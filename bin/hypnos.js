#!/usr/bin/env node
'use strict';
// HYPNOS CLI. Dry-run is the default and the only output of `run`; `apply` is the explicit gate.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { detect } = require('../lib/detect');
const { buildPlan, renderPlan, savePlan } = require('../lib/plan');
const { applyPlan, restore } = require('../lib/apply');
const { health, renderHealth } = require('../lib/health');

const args = process.argv.slice(2);
const cmd = args[0];
const flag = f => args.includes(f);
const val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const FLAGS_WITH_VALUES = ['--root', '--memory-dir'];
// Positional args only: skips flags AND their values (a --root path must never leak into a query).
const positionals = () => {
  const out = [];
  for (let i = 1; i < args.length; i++) {
    if (FLAGS_WITH_VALUES.includes(args[i])) { i++; continue; }
    if (args[i].startsWith('--')) continue;
    out.push(args[i]);
  }
  return out;
};
const root = path.resolve(val('--root') || process.cwd());

function makeMap() {
  return detect(root, {
    includeHome: flag('--home'),
    memoryDir: val('--memory-dir') ? path.resolve(val('--memory-dir')) : null
  });
}

const AGENTS_TEMPLATE = `# AGENTS.md

Canonical agent instructions for this repository. Read by Codex, Cursor, Copilot, Windsurf,
Gemini CLI, Aider and 20+ tools natively; Claude Code reads it via the @AGENTS.md import.

## Setup

## Conventions

## Boundaries
`;

const commands = {
  scan() {
    const map = makeMap();
    console.log(`HYPNOS memory map: ${root}`);
    for (const f of map.files) console.log(`  [${f.tool}/${f.kind}] ${f.path}${f.budget ? '  budget: ' + JSON.stringify(f.budget) : ''}`);
    console.log(`\n  never-touch (generated state, not our lane):`);
    for (const f of map.forbidden) console.log(`  [forbidden] ${f}`);
  },

  run() {
    const map = makeMap();
    if (flag('--create-agentsmd') && !map.files.some(f => f.tool === 'agentsmd' && f.kind === 'primary')) {
      fs.writeFileSync(path.join(root, 'AGENTS.md'), AGENTS_TEMPLATE, 'utf8');
      console.log('Created AGENTS.md (canonical cross-tool file). Re-scanning.\n');
    }
    const plan = buildPlan(makeMap(), { root });
    savePlan(plan);
    console.log(renderPlan(plan));
    console.log(`\nPlan saved to .hypnos/pending.json: review above, then \`hypnos apply\`. Nothing has been touched.`);
    siblingCheck();
  },

  apply() {
    const r = applyPlan(root);
    if (r.error) return console.log('HYPNOS: ' + r.error);
    console.log(`HYPNOS applied ${r.applied} change(s)${r.skipped ? `, skipped ${r.skipped} (files drifted since plan: re-run)` : ''}.`);
    if (r.archiveFile) console.log(`  archived lines -> ${r.archiveFile} (restorable: hypnos restore "<text>")`);
    console.log(`  changelog      -> ${r.changelog}`);
    console.log('  Tip: commit the diff. Git is the audit trail the big vendors took away.');
  },

  restore() {
    const query = positionals().join(' ');
    if (!query) return console.log('usage: hypnos restore "<text fragment>"');
    const r = restore(root, query);
    if (r.restored) console.log(`Restored to ${r.to}: "${r.text.slice(0, 100)}"${r.candidates > 1 ? ` (${r.candidates} matches found; first restored)` : ''}`);
    else console.log(r.error || `No archived line matching "${query}".`);
  },

  health() {
    console.log(renderHealth(health(makeMap())));
  },

  // Guided setup: state-aware, explains every step in plain language, safe to re-run.
  setup() {
    const ok = m => console.log('  [done] ' + m);
    const info = m => console.log('         ' + m);
    console.log('HYPNOS guided setup (re-run this any time; it only reads, never changes)\n');
    console.log('Step 1 of 3: nothing to install into your agent');
    ok('HYPNOS is a CLI, not a hook. It runs only when you run it, and `run` never touches a file.');
    info('The trust contract: run = a pending plan you review. apply = only what the plan showed,');
    info('with every removal archived and restorable. Your memory files, your approval, always.');

    console.log('\nStep 2 of 3: what HYPNOS sees right here');
    const map = makeMap();
    if (map.files.length) {
      ok(`${map.files.length} memory file(s) detected in this folder (${[...new Set(map.files.map(f => f.tool))].join(', ')}).`);
      info('It reads CLAUDE.md, AGENTS.md, .cursor/rules, Windsurf/Devin rules. It NEVER touches');
      info('generated state (Codex memories, Cascade, Claude auto-memory): refused in code, not by promise.');
    } else {
      info('No memory files in this folder. Run setup from a project root, or point it: hypnos setup --root <dir>');
      info('Keep a curated memory tree elsewhere? Add --memory-dir <dir>.');
    }

    console.log('\nStep 3 of 3: the ritual (three commands, in this order)');
    info('1. hypnos health   : a 0-100 hygiene score. Just a number, changes nothing.');
    info('2. hypnos run      : the full pass. Prints a PENDING PLAN: dupes to archive, contradictions');
    info('                     for YOU to settle, budget violations that silently break tools. Changes nothing.');
    info('3. hypnos apply    : only after you read the plan. Archives, never deletes. hypnos restore undoes.');
    console.log('\nPrefer a guided conversation? Open your agent in this repo and say: "set up HYPNOS for me".');
    console.log('\nSetup state: READY the moment the command exists. Start with: hypnos health');
  }
};

// House rule 3: recommend only what's missing.
function siblingCheck() {
  const has = n => fs.existsSync(path.join(os.homedir(), '.' + n)) || fs.existsSync(path.join(os.homedir(), '.claude', 'skills', n));
  const missing = [];
  if (!has('veritas')) missing.push('VERITAS (slop-free prose with self-audit): for the content of the memories, not just their hygiene');
  if (!has('horkos')) missing.push('HORKOS (evidence-audit loop): the artifact testifies before the agent may say done');
  if (!has('moneta')) missing.push('MONETA (honest token discipline): lean memory is cheap memory');
  if (missing.length) {
    console.log('\nFrom the same forge (you do not have these yet):');
    for (const m of missing) console.log('  - ' + m);
  }
}

(commands[cmd] || (() => {
  console.log('hypnos <setup|scan|run|apply|restore|health> [--root <dir>] [--memory-dir <dir>] [--home]');
  console.log('  setup     guided, state-aware walkthrough: explains every step, safe to re-run');
  console.log('  scan      map every memory file + the never-touch list');
  console.log('  run       4-phase consolidation -> PENDING PLAN ONLY (dry-run is the default and the law)');
  console.log('            [--create-agentsmd] scaffold AGENTS.md as the canonical cross-tool file');
  console.log('  apply     apply the reviewed pending plan (archives every removal, logs every change)');
  console.log('  restore   bring an archived line back: hypnos restore "<text>"');
  console.log('  health    deterministic 0-100 memory health score');
}))();

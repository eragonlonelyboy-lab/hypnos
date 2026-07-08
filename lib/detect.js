'use strict';
// HYPNOS convention detector: maps every agent-memory file it may touch, and: just as
// important: everything it must NEVER touch (generated state belongs to the vendors).
const fs = require('fs');
const path = require('path');
const os = require('os');

// Per-tool constraints HYPNOS must respect (research-verified 2026-07).
const BUDGETS = {
  claude_lines_per_file: 200,
  windsurf_global_chars: 6000,
  windsurf_rule_chars: 12000,
  cursor_always_apply_words: 200
};

function exists(p) { try { return fs.existsSync(p); } catch { return false; } }

// Archives are the product of archive-not-delete discipline: they duplicate live content
// ON PURPOSE. Scanning them as live memory would punish exactly the right behavior.
const SKIP_DIRS = /^(node_modules|\.git|\.hypnos)$|archive/i;

// A directory holding its own .git is a DIFFERENT project: a vendored checkout, a submodule,
// a product repo living under the memory tree. Its AGENTS.md/README belongs to that project,
// not to this user's curated memory. Walking in produced two live falsehoods (dogfood
// 2026-07-08): a bare `hypnos health` under a memory tree graded a vendored third-party
// AGENTS.md 100/100 and called it "your memory health", and a --memory-dir sweep counted
// sibling product READMEs as 8.5k duplicate memory lines. Skip nested repos; never the root.
function isNestedRepo(p) { return exists(path.join(p, '.git')); }

function listFiles(dir, filter) {
  const out = [];
  if (!exists(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    let st; try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (!SKIP_DIRS.test(name) && !isNestedRepo(p)) out.push(...listFiles(p, filter)); }
    else if (!filter || filter(p)) out.push(p);
  }
  return out;
}

// Build the memory map for a project root (+ optionally the user's home-level files).
function detect(root, opts = {}) {
  const home = os.homedir();
  const files = [];
  const add = (p, tool, kind, budget) => { if (exists(p)) files.push({ path: p, tool, kind, budget: budget || null }); };

  // Claude Code: curated files only. Auto-memory belongs to Auto Dream; not our lane.
  add(path.join(root, 'CLAUDE.md'), 'claude', 'primary', { lines: BUDGETS.claude_lines_per_file });
  add(path.join(root, '.claude', 'CLAUDE.md'), 'claude', 'primary', { lines: BUDGETS.claude_lines_per_file });
  add(path.join(root, 'CLAUDE.local.md'), 'claude', 'local', { lines: BUDGETS.claude_lines_per_file });
  for (const p of listFiles(path.join(root, '.claude', 'rules'), x => x.endsWith('.md')))
    files.push({ path: p, tool: 'claude', kind: 'rule', budget: { lines: BUDGETS.claude_lines_per_file } });
  if (opts.includeHome) add(path.join(home, '.claude', 'CLAUDE.md'), 'claude', 'global', { lines: BUDGETS.claude_lines_per_file });

  // AGENTS.md: the cross-tool standard (root + nested). Plain markdown, no frontmatter.
  add(path.join(root, 'AGENTS.md'), 'agentsmd', 'primary', { no_frontmatter: true });
  for (const p of listFiles(root, x => path.basename(x) === 'AGENTS.md' && path.dirname(x) !== root)) {
    if (!p.includes('node_modules') && !p.includes('.git')) files.push({ path: p, tool: 'agentsmd', kind: 'nested', budget: { no_frontmatter: true } });
  }

  // Cursor: .mdc files: YAML frontmatter MUST be preserved or rules stop firing.
  for (const p of listFiles(path.join(root, '.cursor', 'rules'), x => x.endsWith('.mdc') || x.endsWith('.md')))
    files.push({ path: p, tool: 'cursor', kind: 'rule', budget: { preserve_frontmatter: true, always_apply_words: BUDGETS.cursor_always_apply_words } });
  add(path.join(root, '.cursorrules'), 'cursor', 'legacy', null);

  // Windsurf / Devin: HARD char caps; over-cap content silently truncates in-product.
  add(path.join(home, '.codeium', 'windsurf', 'memories', 'global_rules.md'), 'windsurf', 'global', { chars: BUDGETS.windsurf_global_chars });
  for (const dir of ['.windsurf', '.devin']) {
    for (const p of listFiles(path.join(root, dir, 'rules'), x => x.endsWith('.md')))
      files.push({ path: p, tool: 'windsurf', kind: 'rule', budget: { chars: BUDGETS.windsurf_rule_chars } });
  }

  // Generic memory dirs (Eragon-style curated memory trees): opt-in via flag.
  if (opts.memoryDir) {
    for (const p of listFiles(opts.memoryDir, x => x.endsWith('.md')))
      files.push({ path: p, tool: 'memory', kind: 'topic', budget: { lines: BUDGETS.claude_lines_per_file } });
  }

  // NEVER-TOUCH list, checked by every write path (defense in depth).
  const forbidden = [
    path.join(home, '.codex', 'memories'),          // Codex generated state
    path.join(home, '.codeium', 'windsurf', 'cascade'), // Cascade memories
    path.join(home, '.claude', 'projects')          // Claude auto-memory: Auto Dream's lane
  ];

  return { files, forbidden, budgets: BUDGETS };
}

function isForbidden(p, map) {
  const abs = path.resolve(p);
  return map.forbidden.some(f => abs.startsWith(path.resolve(f)));
}

// Split a .mdc (or any) file into {frontmatter, body}. Frontmatter is returned VERBATIM.
function splitFrontmatter(content) {
  const m = content.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/);
  return m ? { frontmatter: m[1], body: m[2] } : { frontmatter: '', body: content };
}

module.exports = { detect, isForbidden, splitFrontmatter, BUDGETS };

'use strict';
// HYPNOS apply + restore: the ONLY code paths that write to memory files.
// Law 1: everything removed goes to a dated archive with a source pointer. Nothing is erased.
// Law 2: every applied change is appended to MEMORY_CHANGELOG.md.
// Law 3: .mdc frontmatter passes through verbatim (splitFrontmatter in the read path).
const fs = require('fs');
const path = require('path');
const { pendingPath } = require('./plan');

function archiveDir(root) { const p = path.join(root, '.hypnos', 'archive'); fs.mkdirSync(p, { recursive: true }); return p; }
function changelogPath(root) { return path.join(root, '.hypnos', 'MEMORY_CHANGELOG.md'); }

function applyPlan(root) {
  const pp = pendingPath(root);
  if (!fs.existsSync(pp)) return { applied: 0, error: 'no pending plan: run `hypnos run` first' };
  const plan = JSON.parse(fs.readFileSync(pp, 'utf8'));
  const stamp = new Date().toISOString().slice(0, 10);
  const archiveFile = path.join(archiveDir(root), `${stamp}.md`);
  const archived = [];
  const changelog = [];

  // Group by file; apply removals bottom-up so line numbers stay valid.
  const byFile = {};
  for (const x of plan.actions) (byFile[x.file] = byFile[x.file] || []).push(x);

  let applied = 0;
  for (const [file, xs] of Object.entries(byFile)) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (const x of xs.sort((p, q) => q.line - p.line)) {
      if (x.type === 'archive-line') {
        const actual = lines[x.line - 1];
        // Drift guard: the file may have changed since the plan was made. Verify before touching.
        if (actual === undefined || actual.trim() !== x.text.trim()) {
          changelog.push(`- SKIPPED (file drifted since plan): ${file}:${x.line}`);
          continue;
        }
        archived.push(`- \`${file}:${x.line}\` (${x.reason})\n  > ${actual.trim()}`);
        lines.splice(x.line - 1, 1);
        changelog.push(`- archived ${file}:${x.line} (${x.reason})`);
        applied++;
      } else if (x.type === 'insert-line') {
        lines.splice(x.line - 1, 0, x.text);
        changelog.push(`- inserted "${x.text}" at ${file}:${x.line} (${x.reason})`);
        applied++;
      }
    }
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
  }

  if (archived.length) {
    fs.appendFileSync(archiveFile, `\n## ${new Date().toISOString()}\n\n${archived.join('\n')}\n`, 'utf8');
  }
  fs.appendFileSync(changelogPath(root), `\n## ${new Date().toISOString()}: hypnos apply (${applied} changes)\n${changelog.join('\n')}\n`, 'utf8');
  fs.unlinkSync(pp); // the plan is consumed; a new run makes a new one
  return { applied, skipped: changelog.filter(c => c.includes('SKIPPED')).length, archiveFile: archived.length ? archiveFile : null, changelog: changelogPath(root) };
}

// Restore: search the archives, append the line back to its source file.
function restore(root, query) {
  const dir = archiveDir(root);
  const hits = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md'))) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const entries = content.split(/\n- /).slice(1);
    for (const e of entries) {
      if (e.toLowerCase().includes(query.toLowerCase())) {
        const m = e.match(/`(.+):(\d+)`/); // greedy: Windows paths carry a drive colon (C:\...)
        const text = (e.match(/>\s*(.+)/) || [])[1];
        if (m && text) hits.push({ archive: f, source: m[1], text });
      }
    }
  }
  if (!hits.length) return { restored: 0, hits: [] };
  const h = hits[0];
  if (fs.existsSync(h.source)) {
    fs.appendFileSync(h.source, `\n${h.text}\n`, 'utf8');
    fs.appendFileSync(changelogPath(root), `\n- restored to ${h.source}: "${h.text.slice(0, 80)}" (from ${h.archive})\n`, 'utf8');
    return { restored: 1, to: h.source, text: h.text, candidates: hits.length };
  }
  return { restored: 0, hits, error: `source file gone: ${h.source}` };
}

module.exports = { applyPlan, restore, archiveDir, changelogPath };

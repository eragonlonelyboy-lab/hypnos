'use strict';
// HYPNOS analysis: dupes, contradictions, budget violations, staleness.
// All deterministic local text ops — zero LLM, zero network, zero rate-limit cost.
const fs = require('fs');
const path = require('path');
const { splitFrontmatter } = require('./detect');

function norm(line) {
  return line.toLowerCase().replace(/[`*_>#\-\[\]().:;,!"']/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadLines(file) {
  let content;
  try { content = fs.readFileSync(file.path, 'utf8').replace(/^﻿/, ''); } catch { return null; }
  const { frontmatter, body } = splitFrontmatter(content);
  const lines = body.split('\n');
  return { ...file, content, frontmatter, body, lines };
}

// --- Duplicates: normalized exact matches of substantive lines, within and across files ---
function findDupes(docs) {
  const seen = new Map(); // norm -> {file, idx}
  const dupes = [];
  for (const d of docs) {
    d.lines.forEach((raw, idx) => {
      const n = norm(raw);
      if (n.length < 25 || raw.trim().startsWith('#')) return; // headers + short lines are structure, not facts
      if (seen.has(n)) {
        const first = seen.get(n);
        if (!(first.file === d.path && first.idx === idx)) dupes.push({ file: d.path, line: idx + 1, text: raw.trim(), duplicate_of: `${first.file}:${first.idx + 1}` });
      } else seen.set(n, { file: d.path, idx });
    });
  }
  return dupes;
}

// --- Contradictions: surfaced, NEVER auto-resolved. Heuristic v1, three detectors, honest about it. ---
const PKG_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];
const DIRECTIVE_RE = /\b(use|always use|prefer|default to|run|install with)\s+([a-z0-9@\/.-]+)/i;

function findContradictions(docs) {
  const out = [];
  // 1. Package-manager conflicts (the classic drifted-trio failure).
  const pmClaims = [];
  for (const d of docs) d.lines.forEach((raw, idx) => {
    const n = norm(raw);
    for (const pm of PKG_MANAGERS) {
      if (new RegExp(`\\b(use|with|via|run|prefer)\\b[^.]*\\b${pm}\\b|\\b${pm}\\s+(install|run|add|exec)\\b`).test(n)) {
        pmClaims.push({ pm, file: d.path, line: idx + 1, text: raw.trim() });
      }
    }
  });
  const pms = [...new Set(pmClaims.map(c => c.pm))];
  if (pms.length > 1) out.push({ kind: 'package-manager', values: pms, claims: pmClaims, proposal: `pick ONE package manager as canonical (most recently modified file wins by default) — currently ${pms.join(' vs ')}` });

  // 2. Directive conflicts: same verb-context, different object ("use X for tests" vs "use Y for tests").
  const directives = new Map(); // topicKey -> [{value, file, line, text}]
  for (const d of docs) d.lines.forEach((raw, idx) => {
    const m = raw.match(DIRECTIVE_RE);
    if (!m) return;
    const after = norm(raw.slice(raw.indexOf(m[2]) + m[2].length));
    const topic = after.replace(/^for\s+/, '').split(' ').slice(0, 3).join(' ');
    if (!topic || topic.length < 4) return;
    const key = topic;
    if (!directives.has(key)) directives.set(key, []);
    directives.get(key).push({ value: m[2].toLowerCase(), file: d.path, line: idx + 1, text: raw.trim() });
  });
  for (const [topic, claims] of directives) {
    const values = [...new Set(claims.map(c => c.value))];
    if (values.length > 1 && claims.length > 1) out.push({ kind: 'directive', topic, values, claims, proposal: `conflicting directives for "${topic}": ${values.join(' vs ')} — human picks the winner` });
  }

  // 3. Numeric conflicts: same label, different number ("max 200 lines" vs "max 300 lines").
  const numeric = new Map();
  for (const d of docs) d.lines.forEach((raw, idx) => {
    const m = norm(raw).match(/\b(max|maximum|limit|cap|under|at most|keep.*under)\s+(?:of\s+)?(\d+)\s+(\w+)/);
    if (!m) return;
    const key = m[3];
    if (!numeric.has(key)) numeric.set(key, []);
    numeric.get(key).push({ value: m[2], file: d.path, line: idx + 1, text: raw.trim() });
  });
  for (const [unit, claims] of numeric) {
    const values = [...new Set(claims.map(c => c.value))];
    if (values.length > 1) out.push({ kind: 'numeric', unit, values, claims, proposal: `conflicting ${unit} limits: ${values.join(' vs ')} — human picks the winner` });
  }
  return out;
}

// --- Budget violations: per-tool hard limits, fail loudly ---
function findBudgetViolations(docs) {
  const out = [];
  for (const d of docs) {
    const b = d.budget || {};
    if (b.lines && d.lines.length > b.lines) out.push({ file: d.path, kind: 'lines', actual: d.lines.length, limit: b.lines, detail: `${d.lines.length} lines > ${b.lines} (overflow content loads partially or not at all)` });
    if (b.chars && d.content.length > b.chars) out.push({ file: d.path, kind: 'chars', actual: d.content.length, limit: b.chars, detail: `${d.content.length} chars > ${b.chars} HARD cap — the product silently truncates the rest` });
    if (b.no_frontmatter && d.frontmatter) out.push({ file: d.path, kind: 'frontmatter', actual: 1, limit: 0, detail: 'AGENTS.md frontmatter spec is not merged — frontmatter here is ignored by most tools' });
    if (b.always_apply_words && /alwaysApply:\s*true/.test(d.frontmatter)) {
      const words = d.body.split(/\s+/).filter(Boolean).length;
      if (words > b.always_apply_words) out.push({ file: d.path, kind: 'alwaysApply-words', actual: words, limit: b.always_apply_words, detail: `alwaysApply body is ${words} words > ${b.always_apply_words} guidance` });
    }
  }
  return out;
}

// --- Staleness heatmap: per-line dates found in text; file mtime as the floor ---
function staleness(docs, now = Date.now()) {
  const out = [];
  for (const d of docs) {
    let mtime; try { mtime = fs.statSync(d.path).mtimeMs; } catch { mtime = now; }
    const fileAgeDays = Math.round((now - mtime) / 86400000);
    const staleLines = [];
    d.lines.forEach((raw, idx) => {
      const m = raw.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
      if (m) {
        const ageDays = Math.round((now - new Date(m[0]).getTime()) / 86400000);
        if (ageDays > 180) staleLines.push({ line: idx + 1, date: m[0], age_days: ageDays, text: raw.trim().slice(0, 120) });
      }
    });
    out.push({ file: d.path, file_age_days: fileAgeDays, stale_dated_lines: staleLines });
  }
  return out;
}

// Importance score gates every prune proposal: recency x reference-frequency x specificity.
// refs counts OTHER files only (a line referencing itself proves nothing), and deprecation
// markers are excluded from tokens (the marker is not content).
const MARKER_WORDS = new Set(['deprecated', 'superseded', 'obsolete', 'longer']);
function importance(line, docs, fileAgeDays, sourcePath) {
  const tokens = norm(line).split(' ').filter(t => t.length > 5 && !MARKER_WORDS.has(t)).slice(0, 4);
  let refs = 0;
  for (const d of docs) {
    if (sourcePath && d.path === sourcePath) continue;
    if (tokens.some(t => d.body.toLowerCase().includes(t))) refs++;
  }
  const specificity = /\d|\/|\\|:/.test(line) ? 2 : 1;                 // paths, ids, numbers = specific
  const recency = fileAgeDays < 30 ? 3 : fileAgeDays < 180 ? 2 : 1;
  return (refs + 1) * specificity * recency; // refs+1: zero external refs must not zero out recency protection
}

function analyze(docsRaw) {
  const docs = docsRaw.map(loadLines).filter(Boolean);
  return {
    docs,
    dupes: findDupes(docs),
    contradictions: findContradictions(docs),
    budget_violations: findBudgetViolations(docs),
    staleness: staleness(docs)
  };
}

module.exports = { analyze, loadLines, norm, importance, findDupes, findContradictions, findBudgetViolations, staleness };

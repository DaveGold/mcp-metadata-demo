#!/usr/bin/env node
/**
 * Checks a codebase's local overlays against this skill's overlay contract (overlays.json).
 * Ships inside the skill so every vendored copy can check itself after a sync:
 *
 *   node <skill-dir>/check-overlays.mjs [--root <repo-root>]
 *
 * No overlay folder is valid (the skill applies as written). Exit 1 on any error.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));

function git(root, args) {
  try {
    return { ok: true, out: execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { ok: false, status: e.status };
  }
}

/** Front matter `contract: <major>` and `overlays: [a.md, b.md]` of the local README. */
export function parseReadme(text) {
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1];
  if (!fm) return null;
  const contract = fm.match(/^contract:\s*(\d+)\s*$/m)?.[1];
  const list = fm.match(/^overlays:\s*\[([^\]]*)\]\s*$/m)?.[1];
  return {
    contract: contract === undefined ? undefined : Number(contract),
    overlays: list === undefined ? undefined : list.split(',').map((s) => s.trim()).filter(Boolean),
  };
}

export function checkOverlays({ root, skillDir = SKILL_DIR } = {}) {
  const errors = [];
  const warnings = [];
  const contract = JSON.parse(readFileSync(join(skillDir, 'overlays.json'), 'utf8'));
  const major = Number(String(contract.contract).split('.')[0]);
  const known = new Set(contract.overlays.map((o) => o.overlay));
  const localDir = join(root, contract.root);

  if (!existsSync(localDir)) return { errors, warnings, localDir, present: false };

  const entries = readdirSync(localDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) errors.push(`${e.name}: only files belong in the overlay folder`);
    else if (!known.has(e.name)) errors.push(`${e.name}: not an overlay in contract ${contract.contract}`);
  }
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);

  if (!files.includes('README.md')) {
    errors.push('README.md is missing: it is the loader and carries the contract version');
  } else {
    const meta = parseReadme(readFileSync(join(localDir, 'README.md'), 'utf8'));
    if (!meta) errors.push('README.md: no front matter (contract, overlays)');
    else {
      if (meta.contract !== major)
        errors.push(`README.md: contract ${meta.contract} does not match the skill's major ${major}`);
      if (!meta.overlays) errors.push('README.md: front matter has no `overlays: [...]` list');
      else {
        const declared = [...meta.overlays].sort().join(', ');
        const actual = [...files].sort().join(', ');
        if (declared !== actual) errors.push(`README.md: overlays [${declared}] ≠ files present [${actual}]`);
      }
    }
  }

  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const text = readFileSync(join(localDir, f), 'utf8');
    for (const m of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      const link = m[1];
      if (/^[a-z]+:/i.test(link)) continue;
      if (!existsSync(resolve(localDir, link))) errors.push(`${f}: link ${link} does not resolve`);
    }
  }

  const inGit = git(root, ['rev-parse', '--is-inside-work-tree']);
  if (!inGit.ok) warnings.push('not a git worktree: tracked/ignored checks skipped');
  else {
    if (git(root, ['check-ignore', '-q', contract.root]).ok)
      errors.push(`${contract.root} is git-ignored: overlays must be committed`);
    for (const f of files) {
      if (!git(root, ['ls-files', '--error-unmatch', join(contract.root, f)]).ok)
        warnings.push(`${f} is not tracked yet`);
    }
  }
  return { errors, warnings, localDir, present: true };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const i = process.argv.indexOf('--root');
  const root =
    i > -1 ? resolve(process.argv[i + 1]) : (git(process.cwd(), ['rev-parse', '--show-toplevel']).out ?? process.cwd()).trim();
  if (!statSync(root).isDirectory()) throw new Error(`no such root: ${root}`);
  const { errors, warnings, localDir, present } = checkOverlays({ root });
  if (!present) console.log(`no overlays at ${localDir} — the skill applies as written`);
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const e of errors) console.error(`error: ${e}`);
  if (present && !errors.length) console.log(`overlays OK: ${localDir}`);
  process.exit(errors.length ? 1 : 0);
}

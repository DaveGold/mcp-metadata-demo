#!/usr/bin/env node
/**
 * A change to the rich-domain-mcp-server skill must bump its version, so a repo that vendors the
 * skill can tell which rules it has. Compares the working tree with a base ref (CI passes the PR's
 * base branch): if any file of the skill changed, `metadata.version` in SKILL.md must be higher than
 * the base's, and CHANGELOG.md must have an entry for it.
 *
 *   node scripts/check-skill-version.mjs origin/main
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const DIRS = [
  '.claude/skills/rich-domain-mcp-server',
  '.codex/skills/rich-domain-mcp-server',
  '.agents/skills/rich-domain-mcp-server',
];
const SKILL = `${DIRS[0]}/SKILL.md`;
const base = process.argv[2] ?? 'origin/main';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const version = (text) => text.match(/^metadata:\n\s+version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$/m)?.[1] ?? null;
const newer = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

const changed = git('diff', '--name-only', base, '--', ...DIRS).trim();
if (!changed) {
  console.log(`skill unchanged against ${base}`);
  process.exit(0);
}
const head = version(readFileSync(SKILL, 'utf8'));
let before = null;
try {
  before = version(git('show', `${base}:${SKILL}`));
} catch {
  // the base has no SKILL.md or no version yet
}
const fail = (msg) => {
  console.error(`check-skill-version: ${msg}\nChanged:\n${changed}`);
  process.exit(1);
};
if (!head) fail(`${SKILL} has no metadata.version`);
if (before && !newer(head, before))
  fail(`the skill changed but metadata.version is still ${head} (base ${before}); bump it`);
const changelog = readFileSync(`${DIRS[0]}/CHANGELOG.md`, 'utf8');
if (!new RegExp(`^## ${head.replaceAll('.', '\\.')} `, 'm').test(changelog))
  fail(`CHANGELOG.md has no entry "## ${head} — <date>"`);
console.log(`skill ${before ?? '(none)'} → ${head}`);

/**
 * The rich-domain-mcp-server skill ships in three places: `.claude/skills` (Claude Code),
 * `.codex/skills` (canonical for Codex) and a pointer in `.agents/skills`. They are kept in
 * sync by hand; this test is the drift guard, and it checks that every relative link in
 * the skill (evidence files, reference implementation) still resolves.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CLAUDE = join(ROOT, '.claude/skills/rich-domain-mcp-server');
const CODEX = join(ROOT, '.codex/skills/rich-domain-mcp-server');
const AGENTS = join(ROOT, '.agents/skills/rich-domain-mcp-server/SKILL.md');

function files(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(dir.length + 1))
    .sort();
}

const frontmatter = (s: string) => s.match(/^---\n([\s\S]*?)\n---\n/)?.[1];

describe('rich-domain-mcp-server skill copies', () => {
  it('.claude and .codex are byte-identical', () => {
    expect(files(CODEX)).toEqual(files(CLAUDE));
    for (const f of files(CLAUDE)) expect(readFileSync(join(CODEX, f), 'utf8'), f).toBe(readFileSync(join(CLAUDE, f), 'utf8'));
  });

  it('the .agents pointer carries the same frontmatter and points at an existing file', () => {
    const pointer = readFileSync(AGENTS, 'utf8');
    expect(frontmatter(pointer)).toBe(frontmatter(readFileSync(join(CLAUDE, 'SKILL.md'), 'utf8')));
    const target = pointer.match(/\]\(([^)]+SKILL\.md)\)/)?.[1];
    expect(target && existsSync(resolve(dirname(AGENTS), target))).toBe(true);
  });

  it('every relative link in the skill resolves', () => {
    for (const f of files(CLAUDE).filter((x) => x.endsWith('.md'))) {
      const path = join(CLAUDE, f);
      const links = [...readFileSync(path, 'utf8').matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map((m) => m[1]);
      for (const link of links.filter((l) => !/^https?:/.test(l))) {
        expect(existsSync(resolve(dirname(path), link)), `${f} → ${link}`).toBe(true);
      }
    }
  });
});

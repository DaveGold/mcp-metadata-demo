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
    for (const f of files(CLAUDE))
      expect(readFileSync(join(CODEX, f), 'utf8'), f).toBe(readFileSync(join(CLAUDE, f), 'utf8'));
  });

  it('the .agents pointer carries the same frontmatter and points at an existing file', () => {
    const pointer = readFileSync(AGENTS, 'utf8');
    expect(frontmatter(pointer)).toBe(frontmatter(readFileSync(join(CLAUDE, 'SKILL.md'), 'utf8')));
    const target = pointer.match(/\]\(([^)]+SKILL\.md)\)/)?.[1];
    expect(target && existsSync(resolve(dirname(AGENTS), target))).toBe(true);
  });

  it('every evidence tag in the skill resolves to a row in references/evidence.md', () => {
    const evidence = readFileSync(join(CLAUDE, 'references/evidence.md'), 'utf8');
    const ids = new Set([...evidence.matchAll(/^\| ([A-Z][A-Za-z0-9-]*) \|/gm)].map((m) => m[1]));
    for (const f of files(CLAUDE).filter((x) => x.endsWith('.md') && !x.startsWith('local-template/')))
      for (const [, tag] of readFileSync(join(CLAUDE, f), 'utf8').matchAll(/\[([A-Z][A-Z]?\d*[a-z]?)\]/g))
        expect(ids.has(tag), `${f} → [${tag}]`).toBe(true);
  });

  it('links are portable: relative links stay inside the skill, repo links are GitHub URLs to files that exist', () => {
    // The skill is meant to be copied into OTHER repos (e.g. a production MCP monorepo), so a
    // relative link into this repo's evals/ or src/ would break there. Evidence and reference
    // implementations are linked by absolute GitHub URL; this checks each one against the tree.
    const GITHUB = 'https://github.com/DaveGold/mcp-metadata-demo/blob/main/';
    for (const f of files(CLAUDE).filter((x) => x.endsWith('.md'))) {
      const path = join(CLAUDE, f);
      const links = [...readFileSync(path, 'utf8').matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map((m) => m[1]);
      for (const link of links) {
        if (link.startsWith(GITHUB)) {
          expect(existsSync(join(ROOT, link.slice(GITHUB.length))), `${f} → ${link}`).toBe(true);
        } else if (!/^https?:/.test(link)) {
          const target = resolve(dirname(path), link);
          expect(target.startsWith(CLAUDE), `${f} → ${link} leaves the skill`).toBe(true);
          expect(existsSync(target), `${f} → ${link}`).toBe(true);
        }
      }
    }
  });
});

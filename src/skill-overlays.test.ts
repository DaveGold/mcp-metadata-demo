/**
 * The skill's overlay contract: a codebase plugs its own knowledge in at fixed points
 * (one overlay per document, outside the skill folder) and vendors the skill unchanged.
 * This guards the generic side — every registered document names its overlay exactly once, at
 * the top, with the path the contract declares — and runs the shipped checker on this repo's own
 * overlays and on broken ones.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error — plain ESM script shipped inside the skill, no type declarations
import { checkOverlays, parseReadme } from '../.claude/skills/rich-domain-mcp-server/check-overlays.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const SKILL = join(ROOT, '.claude/skills/rich-domain-mcp-server');
const contract = JSON.parse(readFileSync(join(SKILL, 'overlays.json'), 'utf8')) as {
  contract: string;
  root: string;
  overlays: { document: string; overlay: string }[];
};
const MAJOR = Number(contract.contract.split('.')[0]);
const MARKER = '**Local overlay:**';

function mdFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => join(e.parentPath, e.name).slice(dir.length + 1));
}

type Result = { errors: string[]; warnings: string[]; present: boolean };
const check = (root: string): Result => checkOverlays({ root, skillDir: SKILL }) as Result;

describe('overlay contract (generic side)', () => {
  it('overlays.json is well-formed: versioned, unique, every document exists', () => {
    expect(contract.contract).toMatch(/^\d+\.\d+$/);
    expect(contract.root).toBe('.skill-local/rich-domain-mcp-server');
    const docs = contract.overlays.map((o) => o.document);
    const names = contract.overlays.map((o) => o.overlay);
    expect(new Set(docs).size).toBe(docs.length);
    expect(new Set(names).size).toBe(names.length);
    for (const d of docs) expect(() => readFileSync(join(SKILL, d)), d).not.toThrow();
    expect(contract.overlays.find((o) => o.document === 'SKILL.md')?.overlay).toBe('README.md');
  });

  it('each reference document names its own overlay exactly once, in its first 10 lines', () => {
    for (const { document, overlay } of contract.overlays.filter((o) => o.document !== 'SKILL.md')) {
      const lines = readFileSync(join(SKILL, document), 'utf8').split('\n');
      const hits = lines.flatMap((l, i) => (l.includes(MARKER) ? [i] : []));
      expect(hits, document).toHaveLength(1);
      expect(hits[0], document).toBeLessThan(10);
      expect(lines[hits[0]], document).toContain(`\`<repo-root>/${contract.root}/${overlay}\``);
    }
  });

  it('no other skill file carries an overlay line', () => {
    const registered = new Set(contract.overlays.map((o) => o.document));
    for (const f of mdFiles(SKILL).filter((x) => !registered.has(x)))
      expect(readFileSync(join(SKILL, f), 'utf8').includes(MARKER), f).toBe(false);
  });

  it('SKILL.md loads the README overlay near the top, and its register matches overlays.json', () => {
    const skill = readFileSync(join(SKILL, 'SKILL.md'), 'utf8');
    const head = skill.split('\n').slice(0, 45).join('\n');
    expect(head).toContain(`\`<repo-root>/${contract.root}/README.md\``);
    const section = skill.slice(skill.indexOf('## Local overlays'), skill.indexOf('## Routing'));
    const rows = [...section.matchAll(/^\| `([^`]+)` \| `([^`]+)` \|/gm)].map((m) => ({
      document: m[1],
      overlay: m[2],
    }));
    expect(rows).toEqual(contract.overlays);
  });

  it('local-template holds exactly one stub per overlay, and its README declares the current major', () => {
    const files = readdirSync(join(SKILL, 'local-template')).sort();
    expect(files).toEqual(contract.overlays.map((o) => o.overlay).sort());
    const meta = parseReadme(readFileSync(join(SKILL, 'local-template/README.md'), 'utf8'));
    expect(meta?.contract).toBe(MAJOR);
  });

  it('the generic skill names no company outside its evidence', () => {
    for (const f of mdFiles(SKILL).filter((x) => x !== 'references/evidence.md'))
      expect(readFileSync(join(SKILL, f), 'utf8'), f).not.toMatch(/Warmtebouw/i);
  });
});

describe('overlay checker', () => {
  it("this repo's own overlays pass", () => {
    const r = check(ROOT);
    expect(r.present).toBe(true);
    expect(r.errors).toEqual([]);
  });

  describe('on a scratch repo', () => {
    const make = (files: Record<string, string>) => {
      const root = mkdtempSync(join(tmpdir(), 'overlays-'));
      const dir = join(root, contract.root);
      mkdirSync(dir, { recursive: true });
      for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
      return root;
    };
    const readme = (major: number, list: string[]) =>
      `---\ncontract: ${major}\noverlays: [${list.join(', ')}]\n---\n# x\n`;
    const run = (files: Record<string, string>) => {
      const root = make(files);
      try {
        return check(root);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    };

    it('no overlay folder is valid', () => {
      const root = mkdtempSync(join(tmpdir(), 'overlays-'));
      expect(check(root)).toMatchObject({ present: false, errors: [] });
      rmSync(root, { recursive: true, force: true });
    });

    it('a well-formed set passes', () => {
      expect(
        run({ 'README.md': readme(MAJOR, ['README.md', 'discovery.md']), 'discovery.md': '# d\n' }).errors,
      ).toEqual([]);
    });

    it('an unknown overlay fails', () => {
      const r = run({ 'README.md': readme(MAJOR, ['README.md', 'foo.md']), 'foo.md': '# f\n' });
      expect(r.errors.join('\n')).toMatch(/foo\.md: not an overlay/);
    });

    it('a README list that differs from the files fails', () => {
      const r = run({ 'README.md': readme(MAJOR, ['README.md']), 'discovery.md': '# d\n' });
      expect(r.errors.join('\n')).toMatch(/≠ files present/);
    });

    it('a contract major mismatch fails', () => {
      const r = run({ 'README.md': readme(MAJOR + 1, ['README.md']) });
      expect(r.errors.join('\n')).toMatch(/does not match the skill's major/);
    });

    it('a missing README fails', () => {
      expect(run({ 'discovery.md': '# d\n' }).errors.join('\n')).toMatch(/README\.md is missing/);
    });

    it('a broken relative link fails', () => {
      const r = run({ 'README.md': readme(MAJOR, ['README.md']) + '[x](nope.md)\n' });
      expect(r.errors.join('\n')).toMatch(/nope\.md does not resolve/);
    });
  });
});

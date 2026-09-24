/**
 * The README points into the source by line range ("here is the WHEN, here the HOW, here the
 * WHAT"). Line ranges rot silently when a file is edited, so this test pins them: every relative
 * link must resolve, a `#Lx-Ly` range must lie inside the file, and every backticked name in the
 * link text (`WHEN TO USE`, `computeBuildingDerived`, …) must appear inside that range.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const README = readFileSync(join(ROOT, 'README.md'), 'utf8');

const links = [...README.matchAll(/\[((?:[^\[\]]|`[^`]*`)+)\]\(([^)\s]+)\)/g)]
  .map((m) => ({ text: m[1], target: m[2] }))
  .filter((l) => !/^(https?:|mailto:|#)/.test(l.target));

describe('README links into the repo', () => {
  it('finds the line-anchored links', () => {
    expect(links.filter((l) => /#L\d+/.test(l.target)).length).toBeGreaterThanOrEqual(15);
  });

  it.each(links.map((l) => [l.target, l.text]))('%s resolves', (target) => {
    const path = target.split('#')[0];
    expect(existsSync(join(ROOT, decodeURIComponent(path))), path).toBe(true);
  });

  it.each(links.filter((l) => /#L\d+/.test(l.target)).map((l) => [l.target, l.text]))(
    '%s covers what its text names',
    (target, text) => {
      const [path, anchor] = target.split('#');
      const [, from, to] = anchor.match(/^L(\d+)(?:-L(\d+))?$/)!;
      const lines = readFileSync(join(ROOT, path), 'utf8').split('\n');
      const a = Number(from), b = Number(to ?? from);
      expect(a).toBeLessThanOrEqual(b);
      expect(b, `${target} runs past the end of the file`).toBeLessThanOrEqual(lines.length);
      expect(lines[a - 1].trim(), `${target} starts on a blank line`).not.toBe('');
      const range = lines.slice(a - 1, b).join('\n');
      for (const [, name] of text.matchAll(/`([^`]+)`/g)) {
        if (/\.(ts|md|json)$/.test(name)) continue;
        expect(range, `${target} should contain ${name}`).toContain(name);
      }
    }
  );
});

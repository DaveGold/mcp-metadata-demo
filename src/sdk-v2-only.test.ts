/**
 * Shipped code runs on the split MCP SDK v2 packages (@modelcontextprotocol/server, client, core,
 * node). SDK v1 (@modelcontextprotocol/sdk) stays installed as a pinned devDependency only for the
 * host-probe instruments in evals/host-probe/, so their measurements stay reproducible. Because v1
 * is resolvable, a stray v1 import in shipped code would still compile and run; this test catches it.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SHIPPED = ['src', 'ui', 'test-utils'];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path);
    return /\.(ts|mts|js|mjs)$/.test(name) ? [path] : [];
  });
}

describe('MCP SDK v2 only', () => {
  it('no shipped source imports @modelcontextprotocol/sdk (v1)', () => {
    const offenders = SHIPPED.flatMap((d) => sources(join(ROOT, d)))
      .filter((f) => !f.endsWith('sdk-v2-only.test.ts'))
      .filter((f) =>
        /from ['"]@modelcontextprotocol\/sdk[/'"]|import\(['"]@modelcontextprotocol\/sdk/.test(readFileSync(f, 'utf8')),
      )
      .map((f) => f.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
  });
});

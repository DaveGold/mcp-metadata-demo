/** docs/wire/ must show what the server sends today. On a diff: `npm run wire-view`, then review it. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WIRE_VIEW_ARMS, renderWireView, markCut, CUT } from './wire-view.js';

const ROOT = resolve(import.meta.dirname, '..');

describe('docs/wire', () => {
  it.each(WIRE_VIEW_ARMS.map((a) => [a.arm, a.blurb]))('docs/wire/%s.md matches the server', async (arm, blurb) => {
    const onDisk = readFileSync(join(ROOT, 'docs/wire', `${arm}.md`), 'utf8');
    expect(onDisk, 'stale — run `npm run wire-view`').toBe(await renderWireView(arm as never, blurb));
  });

  it('marks the cut only past 2,048 characters, at exactly that character', () => {
    expect(markCut('x'.repeat(CUT))).not.toContain('✂');
    const marked = markCut('a'.repeat(CUT) + 'LOST');
    expect(marked).toContain('✂');
    expect(marked.indexOf('LOST')).toBeGreaterThan(marked.indexOf('✂'));
  });
});

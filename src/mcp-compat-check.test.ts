/**
 * The mcp-compat-check skill's script, run against the local schema-probe server: its limits must
 * match what the clients were measured to deliver (evals/results/2026-09-27-host-delivery.json).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const run = () =>
  JSON.parse(
    execFileSync(
      'node',
      [
        '.claude/skills/mcp-compat-check/check.mjs',
        '--json',
        '--stdio',
        '--',
        'node',
        'evals/host-probe/schema-probe-server.mjs',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

describe('mcp-compat-check', () => {
  const report = run();
  const tool = (name: string) => report.tools.find((t: { name: string }) => t.name === name);

  it('flags an input schema over 5,000 chars for ChatGPT / Codex only, not for Claude', () => {
    expect(tool('exact_5000').perClient.openai.status).toBe('green');
    expect(tool('exact_5001').perClient.openai.status).toBe('red');
    expect(tool('exact_5001').perClient.claude.status).toBe('green');
    expect(tool('exact_5001').perClient.all.status).toBe('red');
  });

  it('ignores nesting, as Codex does', () => {
    expect(tool('nest12_small').perClient.all.status).toBe('green');
  });
});

/**
 * The mcp-compat-check skill's script, run against the local probe servers: its limits must match
 * what the clients were measured to deliver (evals/results/2026-09-27-host-delivery.json for the
 * 5,000 schema limit, evals/results/2026-11-17-host-delivery-retest.json for the rest).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const run = (probe = 'evals/host-probe/schema-probe-server.mjs') =>
  JSON.parse(
    execFileSync('node', ['.claude/skills/mcp-compat-check/check.mjs', '--json', '--stdio', '--', 'node', probe], {
      cwd: ROOT,
      encoding: 'utf8',
    }),
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

  describe('against the delivery probe, as measured on 2026-11-17 (HD2)', () => {
    const d = run('evals/host-probe/delivery-probe-server.mjs');
    const dt = (name: string) => d.tools.find((t: { name: string }) => t.name === name);

    it('cuts a description over 4,096 for Claude only, not for ChatGPT / Codex or Mistral', () => {
      expect(dt('probe_desc_8k').perClient.claude.status).toBe('red');
      expect(dt('probe_desc_8k').perClient.openai.status).toBe('green');
      expect(dt('probe_desc_8k').perClient.mistral.status).toBe('green');
    });

    it('drops describes past 5,000 on ChatGPT / Codex only', () => {
      expect(dt('probe_schema_large').perClient.openai.status).toBe('red');
      expect(dt('probe_schema_large').perClient.mistral.status).toBe('green');
    });

    it('treats 8,192 chars of instructions as over the 512 and 4,096 cuts, and as undelivered on Mistral', () => {
      expect(d.instructions.openai.status).toBe('red');
      expect(d.instructions.claude.status).toBe('red');
      expect(d.instructions.mistral.note).toContain('none delivered');
    });

    it('counts the output schema as delivered on ChatGPT / Codex only', () => {
      expect(dt('probe_output').perClient.openai.status).toBe('green');
      expect(dt('probe_output').perClient.claude.status).toBe('amber');
      expect(dt('probe_output').perClient.mistral.status).toBe('amber');
    });
  });
});

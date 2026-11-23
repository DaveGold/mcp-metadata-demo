/**
 * The v2 delivery probe must measure the same thing as the v1 probe HD and HD2 ran on: identical labels and
 * codes (`truth`), and identical tools/list and instructions on the wire, in both protocol eras. It must
 * also serve 2026-07-28 for real, log the era of every request, and refuse 2025-era clients under
 * --modern-only, so a host that still connects shows it cannot speak the new revision.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { join, resolve } from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const DIR = resolve(import.meta.dirname);
const V1 = join(DIR, 'delivery-probe-server.mjs');
const V2 = join(DIR, 'delivery-probe-server-v2.mjs');
type Mode = 'legacy' | { pin: string };

async function surface(transport: StdioClientTransport | StreamableHTTPClientTransport, mode: Mode) {
  const client = new Client({ name: 'probe-test', version: '0' }, { versionNegotiation: { mode } });
  await client.connect(transport);
  const out = {
    era: client.getProtocolEra(),
    version: client.getNegotiatedProtocolVersion(),
    instructions: client.getInstructions() ?? '',
    tools: (await client.listTools()).tools,
  };
  await client.close();
  return out;
}
const stdio = (file: string) => new StdioClientTransport({ command: 'node', args: [file], stderr: 'ignore' });

describe('delivery probe v2', () => {
  it('produces the identical truth table as the v1 probe', () => {
    const run = (f: string) => execFileSync('node', [f, 'truth'], { encoding: 'utf8' });
    expect(run(V2)).toBe(run(V1));
  });

  it('serves the v1 tools/list and instructions, byte for byte, in both eras over stdio', async () => {
    const v1 = await surface(stdio(V1), 'legacy');
    const legacy = await surface(stdio(V2), 'legacy');
    const modern = await surface(stdio(V2), { pin: '2026-07-28' });
    expect([legacy.era, modern.era, modern.version]).toEqual(['legacy', 'modern', '2026-07-28']);
    for (const s of [legacy, modern]) {
      expect(JSON.stringify(s.tools)).toBe(JSON.stringify(v1.tools));
      expect(s.instructions).toBe(v1.instructions);
    }
  }, 30_000);

  describe('over HTTP', () => {
    const procs: ChildProcess[] = [];
    const logs: string[] = [];
    afterAll(() => procs.forEach((p) => p.kill()));

    async function start(...flags: string[]): Promise<string> {
      const port = 40000 + Math.floor(Math.random() * 20000);
      const p = spawn('node', [V2, 'http', String(port), ...flags], { stdio: ['ignore', 'ignore', 'pipe'] });
      procs.push(p);
      await new Promise<void>((ok, fail) => {
        p.stderr!.on('data', (d: Buffer) => {
          logs.push(...d.toString().split('\n').filter(Boolean));
          if (d.toString().includes('deliveryprobe (SDK v2')) ok();
        });
        p.once('exit', () => fail(new Error('probe exited before listening')));
      });
      return `http://127.0.0.1:${port}/mcp`;
    }

    it('serves both eras and logs the era, protocol version and client of each request', async () => {
      const url = await start();
      const modern = await surface(new StreamableHTTPClientTransport(new URL(url)), { pin: '2026-07-28' });
      const legacy = await surface(new StreamableHTTPClientTransport(new URL(url)), 'legacy');
      expect([modern.era, legacy.era]).toEqual(['modern', 'legacy']);
      expect(JSON.stringify(modern.tools)).toBe(JSON.stringify(legacy.tools));
      expect(logs.some((l) => /POST server\/discover pv=2026-07-28 client=probe-test\/0/.test(l))).toBe(true);
      expect(logs.some((l) => / modern tools\/list ua=/.test(l))).toBe(true);
      expect(logs.some((l) => /POST initialize pv=2025-11-25 client=probe-test\/0/.test(l))).toBe(true);
      expect(logs.some((l) => / legacy tools\/list ua=/.test(l))).toBe(true);
    }, 30_000);

    it('refuses a 2025-era client under --modern-only, and still serves 2026-07-28', async () => {
      const url = await start('--modern-only');
      await expect(surface(new StreamableHTTPClientTransport(new URL(url)), 'legacy')).rejects.toThrow();
      const modern = await surface(new StreamableHTTPClientTransport(new URL(url)), { pin: '2026-07-28' });
      expect(modern.era).toBe('modern');
    }, 30_000);
  });
});

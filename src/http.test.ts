import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpApp } from './http.js';

describe('createHttpApp', () => {
  let base = '';
  let close: () => void = () => {};

  beforeAll(async () => {
    process.env.EP_ONLINE_API_KEY ??= 'test-key'; // initialize never calls EP-Online
    const server = createHttpApp({ hosted: false }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => server.close();
  });
  afterAll(() => close());

  // A stateless server with no SSE stream must answer GET and DELETE with 405 (MCP spec).
  it.each(['GET', 'DELETE'])('answers %s on / and /mcp with 405 and Allow: POST', async (method) => {
    for (const path of ['/', '/mcp']) {
      const res = await fetch(base + path, { method, headers: { accept: 'text/event-stream' } });
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('POST');
    }
  });

  it('still answers initialize over POST', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
      }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).result.serverInfo.name).toBe('metadata-demo');
  });
});

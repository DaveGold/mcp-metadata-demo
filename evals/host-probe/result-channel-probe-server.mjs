// MCP server whose tools return the same call result through different channels, each tagged with
// a fingerprint unique to its channel: C_<tool> in content text, S_<tool> in structuredContent,
// M_<tool> in result _meta, I_<tool> as an image block. Ask the model to quote each tool's result;
// the fingerprints it can quote are the channels that reached it (evals/open-questions.md Q28).
//   node evals/host-probe/result-channel-probe-server.mjs              # stdio
//   node evals/host-probe/result-channel-probe-server.mjs http 8787    # streamable HTTP on /mcp, stateless
import { createServer } from 'node:http';
import { Server } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js';
import { StdioServerTransport } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js';
import { StreamableHTTPServerTransport } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/types.js';

// 1×1 transparent PNG: an image block carries no text, so only its presence is measurable.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const text = (t) => ({ type: 'text', text: `C_${t}: this sentence is the content text of ${t}.` });
const structured = (t) => ({ fingerprint: `S_${t}`, note: `this object is the structuredContent of ${t}.` });
const outputSchema = {
  type: 'object',
  properties: { fingerprint: { type: 'string' }, note: { type: 'string' } },
  required: ['fingerprint', 'note'],
};
// [name, what it returns, declares outputSchema?]
const PROBES = [
  ['content_only', (t) => ({ content: [text(t)] }), false],
  ['structured_only', (t) => ({ content: [], structuredContent: structured(t) }), true],
  ['both_divergent', (t) => ({ content: [text(t)], structuredContent: structured(t) }), false],
  ['both_divergent_schema', (t) => ({ content: [text(t)], structuredContent: structured(t) }), true],
  ['both_json_mirror', (t) => ({ content: [{ type: 'text', text: JSON.stringify(structured(t)) }], structuredContent: structured(t) }), true],
  ['both_with_image', (t) => ({ content: [{ type: 'image', data: PNG, mimeType: 'image/png' }, text(t)], structuredContent: structured(t) }), false],
  ['both_with_meta', (t) => ({ content: [text(t)], structuredContent: structured(t), _meta: { fingerprint: `M_${t}` } }), false],
  ['error_with_structured', (t) => ({ isError: true, content: [text(t)], structuredContent: structured(t) }), false],
];
const tools = PROBES.map(([name, , schema]) => ({
  name: `probe_${name}`,
  description: `Result-channel probe ${name}. Takes no arguments. When asked to probe, call it once and quote its whole result verbatim.`,
  inputSchema: { type: 'object', properties: {} },
  ...(schema && { outputSchema }),
}));

function server() {
  const s = new Server({ name: 'resultprobe', version: '0.0.1' }, { capabilities: { tools: {} } });
  s.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  s.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name.replace(/^probe_/, '');
    const probe = PROBES.find(([n]) => n === name);
    if (!probe) return { isError: true, content: [{ type: 'text', text: `unknown probe ${req.params.name}` }] };
    return probe[1](name);
  });
  return s;
}

if (process.argv[2] === 'http') {
  const port = Number(process.argv[3] ?? 8787);
  createServer(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) return void res.writeHead(404).end();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close());
    await server().connect(transport);
    await transport.handleRequest(req, res);
  }).listen(port, () => console.error(`resultprobe on http://localhost:${port}/mcp`));
} else {
  await server().connect(new StdioServerTransport());
}

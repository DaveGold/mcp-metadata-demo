// One MCP server that measures, in a single pass per host, what reaches the model of every metadata surface:
// tool description (8k and 20k), server instructions (8k), input schema (under and over 5,000 chars),
// output schema, and the result channel of a call (content / structuredContent / _meta / image, as Q28).
// Every surface is cut into numbered blocks "[X-<offset> <code>]"; the code is pseudo-random from a fixed
// seed, so a model can only quote it if the block reached it. The last block it can quote is the cut.
//   node evals/host-probe/delivery-probe-server.mjs              # stdio
//   node evals/host-probe/delivery-probe-server.mjs http 8787    # streamable HTTP on /mcp, stateless; logs calls to stderr
//   node evals/host-probe/delivery-probe-server.mjs truth        # the label table to score answers against
import { createServer } from 'node:http';
import { Server } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js';
import { StdioServerTransport } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js';
import { StreamableHTTPServerTransport } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/types.js';

// mulberry32, fixed seed: the same codes on every run, so `truth` matches what the hosts saw.
let seed = 0x5eed2611;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ABC = 'abcdefghjkmnpqrstuvwxyz';
const code = () => Array.from({ length: 3 }, () => ABC[Math.floor(rnd() * ABC.length)]).join('');
const FILL = ' filler text that only pads this block to its fixed length so the next label starts at a known offset.';
const truth = {};

// A text of `total` chars made of blocks of `size` chars, each opening with its label. `head` goes in block 0.
function blocks(tag, total, size, head = '') {
  const labels = [];
  let out = '';
  for (let off = 0; off < total; off += size) {
    const label = `[${tag}-${String(off).padStart(5, '0')} ${code()}]`;
    labels.push(label);
    let b = label + (off === 0 && head ? ' ' + head : '');
    while (b.length < size) b += FILL;
    out += b.slice(0, size);
  }
  truth[tag] = { chars: out.length, blockChars: size, first: labels[0], last: labels.at(-1), labels };
  return out;
}

// An input schema of flat string params whose describes carry labels; padded to reach about `target` JSON chars.
function schema(tag, n, target) {
  const props = {};
  const labels = [];
  for (let i = 0; i < n; i++) { const l = `[${tag}-${String(i).padStart(2, '0')} ${code()}]`; labels.push(l); props['p' + i] = { type: 'string', description: l }; }
  const per = Math.max(0, Math.floor((target - JSON.stringify({ type: 'object', properties: props }).length) / n));
  for (const p of Object.values(props)) { let d = p.description; while (d.length < p.description.length + per) d += FILL; p.description = d.slice(0, p.description.length + per); }
  const s = { type: 'object', properties: props };
  truth[tag] = { chars: JSON.stringify(s).length, params: n, first: labels[0], last: labels.at(-1), labels };
  return s;
}

const INSTRUCTIONS = blocks('I', 8192, 256, 'These are the server instructions of deliveryprobe, a measurement server.');
const outLabels = Array.from({ length: 4 }, (_, i) => `[O-${i} ${code()}]`);
truth.O = { labels: outLabels };
const outputSchema = { type: 'object', properties: Object.fromEntries(outLabels.map((l, i) => ['o' + i, { type: 'string', description: l }])) };

const META = [
  { name: 'probe_desc_8k', description: blocks('D8', 8192, 256, 'Delivery probe, do not call. This description is 8,192 characters of numbered blocks.'), inputSchema: { type: 'object', properties: {} } },
  { name: 'probe_desc_20k', description: blocks('D20', 20480, 512, 'Delivery probe, do not call. This description is 20,480 characters of numbered blocks.'), inputSchema: { type: 'object', properties: {} } },
  { name: 'probe_schema_small', description: 'Delivery probe, do not call. Its input schema is under 5,000 characters; every parameter describe carries a label.', inputSchema: schema('PS', 8, 2000) },
  { name: 'probe_schema_large', description: 'Delivery probe, do not call. Its input schema is over 5,000 characters; every parameter describe carries a label.', inputSchema: schema('PL', 30, 7000) },
  { name: 'probe_output', description: 'Delivery probe, do not call. It declares an output schema whose field describes carry labels.', inputSchema: { type: 'object', properties: {} }, outputSchema },
];

// Result channels, as Q28 (result-channel-probe-server.mjs) with fresh codes.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const fp = {};
const mk = (ch, t) => (fp[`${ch}_${t}`] ??= `${ch}_${t}_${code()}`);
const text = (t) => ({ type: 'text', text: `${mk('C', t)}: this sentence is the content text of ${t}.` });
const structured = (t) => ({ fingerprint: mk('S', t), note: `this object is the structuredContent of ${t}.` });
const chanSchema = { type: 'object', properties: { fingerprint: { type: 'string' }, note: { type: 'string' } }, required: ['fingerprint', 'note'] };
const CHANNELS = [
  ['content_only', (t) => ({ content: [text(t)] }), false],
  ['structured_only', (t) => ({ content: [], structuredContent: structured(t) }), true],
  ['both_divergent', (t) => ({ content: [text(t)], structuredContent: structured(t) }), false],
  ['both_divergent_schema', (t) => ({ content: [text(t)], structuredContent: structured(t) }), true],
  ['both_json_mirror', (t) => ({ content: [{ type: 'text', text: JSON.stringify(structured(t)) }], structuredContent: structured(t) }), true],
  ['both_with_image', (t) => ({ content: [{ type: 'image', data: PNG, mimeType: 'image/png' }, text(t)], structuredContent: structured(t) }), false],
  ['both_with_meta', (t) => ({ content: [text(t)], structuredContent: structured(t), _meta: { fingerprint: mk('M', t) } }), false],
  ['error_with_structured', (t) => ({ isError: true, content: [text(t)], structuredContent: structured(t) }), false],
];
for (const [n, f] of CHANNELS) f(n); // fix every fingerprint now, so `truth` lists them
truth.channels = fp;
const CHAN = CHANNELS.map(([name, , sch]) => ({
  name: `chan_${name}`,
  description: `Result-channel probe ${name}. Takes no arguments. When asked to probe, call it once and quote its whole result verbatim.`,
  inputSchema: { type: 'object', properties: {} },
  ...(sch && { outputSchema: chanSchema }),
}));
const TOOLS = [...META, ...CHAN];

function server(log) {
  const s = new Server({ name: 'deliveryprobe', version: '0.1.0' }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS });
  s.setRequestHandler(ListToolsRequestSchema, async () => { log('tools/list'); return { tools: TOOLS }; });
  s.setRequestHandler(CallToolRequestSchema, async (req) => {
    log(`tools/call ${req.params.name}`);
    const ch = CHANNELS.find(([n]) => `chan_${n}` === req.params.name);
    if (ch) return ch[1](ch[0]);
    return { content: [{ type: 'text', text: `${req.params.name} is a delivery probe and returns nothing.` }] };
  });
  return s;
}

const mode = process.argv[2];
if (mode === 'truth') {
  console.log(JSON.stringify({ instructionsChars: INSTRUCTIONS.length, tools: TOOLS.map((t) => ({ name: t.name, descriptionChars: t.description.length, inputSchemaChars: JSON.stringify(t.inputSchema).length, outputSchema: !!t.outputSchema })), truth }, null, 1));
} else if (mode === 'http') {
  const port = Number(process.argv[3] ?? 8787);
  createServer(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) return void res.writeHead(404).end();
    const ua = req.headers['user-agent'] ?? '-';
    const log = (what) => console.error(`${new Date().toISOString()} ${what} ua=${ua}`);
    if (req.method !== 'POST') log(`${req.method} ${req.url}`);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close());
    await server(log).connect(transport);
    await transport.handleRequest(req, res);
  }).listen(port, () => console.error(`deliveryprobe on http://localhost:${port}/mcp`));
} else {
  await server(() => {}).connect(new StdioServerTransport());
}

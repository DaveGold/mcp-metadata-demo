// The delivery probe (delivery-probe-server.mjs) on MCP SDK v2: the SAME surfaces, labels and codes,
// served in both protocol eras, 2026-07-28 (per-request envelope, instructions via server/discover) and
// the 2025 era (initialize handshake). Every request is logged with the era the host used, so a host's
// answers can be scored against `truth` AND tied to the protocol it spoke. HD and HD2 ran on the v1
// probe; keep that file unchanged so they stay reproducible. delivery-probe-v2.test.ts checks that both
// files produce the identical `truth` and the identical tools/list.
//   node evals/host-probe/delivery-probe-server-v2.mjs                          # stdio, both eras
//   node evals/host-probe/delivery-probe-server-v2.mjs http 8787                # streamable HTTP on /mcp, both eras
//   node evals/host-probe/delivery-probe-server-v2.mjs http 8787 --modern-only  # 2025-era requests are refused
//   node evals/host-probe/delivery-probe-server-v2.mjs truth                    # the label table to score answers against
// Log lines go to stderr: `<time> <era> <method> pv=<protocol version> client=<name/version> ua=<user agent>`.
// --modern-only answers a 2025-era request with the unsupported-protocol-version error, so a host that
// still connects tells you it cannot speak 2026-07-28.
import { createServer } from 'node:http';
import { Server, createMcpHandler } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { toNodeHandler } from '@modelcontextprotocol/node';

// ── Surfaces: copied verbatim from delivery-probe-server.mjs (same seed, same order of code() calls). ──

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

// ── Serving: SDK v2, both eras. ──

const PV = 'io.modelcontextprotocol/protocolVersion';
const CI = 'io.modelcontextprotocol/clientInfo';
const who = (info) => (info?.name ? `${info.name}/${info.version ?? '?'}` : '-');

// One JSON-RPC message (or batch) as `<method> pv=<version> client=<name/version>`, from the 2026 envelope or initialize.
function describe(msg) {
  if (Array.isArray(msg)) return msg.map(describe).join(' | ');
  if (!msg || typeof msg !== 'object') return '(no body)';
  const meta = msg.params?._meta ?? {};
  const pv = meta[PV] ?? msg.params?.protocolVersion ?? '-';
  const client = who(meta[CI] ?? msg.params?.clientInfo);
  return `${msg.method ?? (msg.result ? 'response' : '?')} pv=${pv} client=${client}`;
}

// `log` writes one line; every line from this instance names the era it serves.
function server(log) {
  const s = new Server({ name: 'deliveryprobe', version: '0.2.0' }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS });
  s.setRequestHandler('tools/list', async () => {
    log('tools/list');
    return { tools: TOOLS };
  });
  s.setRequestHandler('tools/call', async (req) => {
    log(`tools/call ${req.params.name}`);
    const ch = CHANNELS.find(([n]) => `chan_${n}` === req.params.name);
    if (ch) return ch[1](ch[0]);
    return { content: [{ type: 'text', text: `${req.params.name} is a delivery probe and returns nothing.` }] };
  });
  return s;
}

const args = process.argv.slice(2);
const modernOnly = args.includes('--modern-only');
const [mode, portArg] = args.filter((a) => !a.startsWith('--'));
const stamp = () => new Date().toISOString();

if (mode === 'truth') {
  console.log(JSON.stringify({ instructionsChars: INSTRUCTIONS.length, tools: TOOLS.map((t) => ({ name: t.name, descriptionChars: t.description.length, inputSchemaChars: JSON.stringify(t.inputSchema).length, outputSchema: !!t.outputSchema })), truth }, null, 1));
} else if (mode === 'http') {
  const port = Number(portArg ?? 8787);
  const log = (what, ua = '-') => console.error(`${stamp()} ${what} ua=${ua}`);
  const handler = toNodeHandler(
    createMcpHandler(
      (ctx) => {
        const ua = ctx.requestInfo?.headers.get('user-agent') ?? '-';
        return server((what) => log(`${ctx.era} ${what}`, ua));
      },
      { legacy: modernOnly ? 'reject' : 'stateless', onerror: (e) => log(`error ${e.message}`) },
    ),
  );
  createServer(async (req, res) => {
    if (!req.url?.startsWith('/mcp')) return void res.writeHead(404).end();
    const ua = req.headers['user-agent'] ?? '-';
    let body;
    if (req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { body = undefined; }
    }
    log(`${req.method} ${req.method === 'POST' ? describe(body) : req.url} header-pv=${req.headers['mcp-protocol-version'] ?? '-'}`, ua);
    await handler(req, res, body);
  }).listen(port, () => console.error(`deliveryprobe (SDK v2${modernOnly ? ', 2026-07-28 only' : ', both eras'}) on http://localhost:${port}/mcp`));
} else {
  const log = (what) => console.error(`${stamp()} ${what}`);
  serveStdio((ctx) => { log(`${ctx.era} connection opened`); return server((what) => log(`${ctx.era} ${what}`)); }, {
    legacy: modernOnly ? 'reject' : 'serve',
    onerror: (e) => log(`error ${e.message}`),
  });
}

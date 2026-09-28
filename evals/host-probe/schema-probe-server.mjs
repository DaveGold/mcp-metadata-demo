// Local stdio MCP server whose tools vary input-schema size and nesting; each describe is tagged M_<tool>_<i>.
// Used to find where Codex drops input-schema describes (evals/results/2026-09-27-host-delivery.json).
// `node evals/host-probe/schema-probe-server.mjs sizes` prints each schema's JSON length and nesting.
import { Server } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js';
import { StdioServerTransport } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '../../node_modules/@modelcontextprotocol/sdk/dist/esm/types.js';
const pad = (tag, n) => (tag + ' ' + 'lorem ipsum dolor sit amet '.repeat(40)).slice(0, n);
// flat: N top-level string params, each describe of L chars
const flat = (name, n, L) => { const p = {}; for (let i = 0; i < n; i++) p['p' + i] = { type: 'string', description: pad('M_' + name + '_' + i, L) }; return { type: 'object', properties: p }; };
// nested: a chain of objects of given depth; each level has one described leaf and one child
const nested = (name, depth, L) => { let node = { type: 'string', description: pad('M_' + name + '_leaf', L) }; for (let d = depth; d >= 1; d--) node = { type: 'object', description: pad('M_' + name + '_d' + d, L), properties: { leaf: { type: 'string', description: pad('M_' + name + '_l' + d, L) }, child: node } }; return { type: 'object', properties: { root: node } }; };
// wide nested: array of objects (like columns[]) with K described props
const arrObj = (name, k, L) => { const p = {}; for (let i = 0; i < k; i++) p['c' + i] = { type: 'string', description: pad('M_' + name + '_' + i, L) }; return { type: 'object', properties: { items: { type: 'array', description: pad('M_' + name + '_arr', L), items: { type: 'object', properties: p } } } }; };

const exact = (name, total) => { const sch = flat(name, 26, 150); const base = JSON.stringify(sch).length; const last = sch.properties.p25; last.description = pad('M_' + name + '_25', 150 + (total - base)); return sch; };
const tools = [
  ['flat_1k', flat('flat_1k', 5, 150)],
  ['flat_3k', flat('flat_3k', 15, 150)],
  ['flat_5k', flat('flat_5k', 25, 150)],
  ['flat_8k', flat('flat_8k', 40, 150)],
  ['flat_16k', flat('flat_16k', 80, 150)],
  ['nest4_small', nested('nest4_small', 4, 60)],
  ['nest8_small', nested('nest8_small', 8, 40)],
  ['nest12_small', nested('nest12_small', 12, 30)],
  ['arrobj_2k', arrObj('arrobj_2k', 10, 150)],
  ['arrobj_6k', arrObj('arrobj_6k', 35, 150)],
  ['flat_n26', flat('flat_n26', 26, 150)],
  ['flat_n27', flat('flat_n27', 27, 150)],
  ['flat_n28', flat('flat_n28', 28, 150)],
  ['flat_n29', flat('flat_n29', 29, 150)],
  ['flat_n30', flat('flat_n30', 30, 150)],
  ['flat_n31', flat('flat_n31', 31, 150)],
  ['flat_n32', flat('flat_n32', 32, 150)],
  ['exact_4999', exact('exact_4999', 4999)], ['exact_5000', exact('exact_5000', 5000)], ['exact_5001', exact('exact_5001', 5001)], ['exact_5002', exact('exact_5002', 5002)],
].map(([name, inputSchema]) => ({ name, description: 'Schema probe tool ' + name + '. Do not call.', inputSchema }));
const s = new Server({ name: 'schemaprobe', version: '0.0.1' }, { capabilities: { tools: {} } });
s.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
s.setRequestHandler(CallToolRequestSchema, async () => ({ content: [{ type: 'text', text: 'probe' }] }));
if (process.argv[2] === 'sizes') { for (const t of tools) { const js = JSON.stringify(t.inputSchema); let d = 0, m = 0; for (const c of js) { if (c === '{') m = Math.max(m, ++d); else if (c === '}') d--; } console.log(t.name, js.length, 'nesting', m, 'markers', (js.match(/M_/g) || []).length); } process.exit(0); }
await s.connect(new StdioServerTransport());

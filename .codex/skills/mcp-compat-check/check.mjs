#!/usr/bin/env node
/**
 * MCP client-compatibility check. Reads a server's tools/list and instructions and scores each
 * surface against what each client family delivered when measured (2026-09-27; see the
 * rich-domain-mcp-server skill, evidence tag HD). No model, no tool calls: deterministic.
 *
 *   node check.mjs https://example.com/mcp            # streamable HTTP
 *   node check.mjs --header "Authorization: Bearer $T" https://…
 *   node check.mjs --stdio -- node server.js           # stdio
 *   node check.mjs --json …                            # machine-readable
 *   node check.mjs --timeout 300 …                     # seconds to wait (default 180)
 */
import { spawn } from 'node:child_process';

// What each client family delivers. null = no limit measured.
const CLIENTS = {
  claude: { label: 'Claude only (Code, claude.ai, Cowork)', desc: 2048, instr: 0, schema: null, output: false },
  openai: { label: 'ChatGPT / Codex only', desc: null, instr: 0, schema: 5000, output: 'partial' },
  all: { label: 'all clients', desc: 2048, instr: 0, schema: 5000, output: false },
};
// instr: 0 means "some client in this family delivers none", so nothing may be required there.
const INSTR_SOFT = { claude: 2048, openai: 512, all: 512 };
const HOST_NOTES = {
  desc: 'Claude Code cuts at 2,048, Cowork at 4,096; claude.ai chat, ChatGPT and Codex deliver it whole.',
  instr: 'claude.ai chat and ChatGPT Work deliver none; ChatGPT Chat cuts at 512; Claude Code at 2,048.',
  schema: 'Codex drops every describe once the serialized input schema passes 5,000 chars (bisected: 5,000 kept, 5,001 dropped); ChatGPT Work behaves the same (20k dropped, 739 kept; not bisected).',
  output: 'Not delivered on Claude Code, claude.ai chat or Cowork; delivered on Codex and ChatGPT Work.',
};

// ── transport ────────────────────────────────────────────────────────────────
async function httpSession(url, headers) {
  let sid;
  async function rpc(body) {
    const h = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers };
    if (sid) h['mcp-session-id'] = sid;
    const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body) });
    sid = r.headers.get('mcp-session-id') ?? sid;
    const text = await r.text();
    if (!r.ok && !text) throw new Error(`HTTP ${r.status} from ${url}`);
    if (body.id === undefined) return null;
    const lines = text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6));
    const msgs = (lines.length ? lines : [text]).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const msg = msgs.find((m) => m.id === body.id);
    if (!msg) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    if (msg.error) throw new Error(`${msg.error.code}: ${msg.error.message}`);
    return msg.result;
  }
  return { rpc, close: async () => {} };
}

function stdioSession(cmd, args) {
  const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'] });
  let buf = '';
  const waiting = new Map();
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try { const m = JSON.parse(line); if (m.id !== undefined && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } } catch {}
    }
  });
  const rpc = (body) => new Promise((resolve, reject) => {
    if (body.id !== undefined) waiting.set(body.id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
    child.stdin.write(JSON.stringify(body) + '\n');
    if (body.id === undefined) resolve(null);
  });
  return { rpc, close: async () => child.kill() };
}

async function readServer(session) {
  let id = 0;
  const init = await session.rpc({ jsonrpc: '2.0', id: ++id, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-compat-check', version: '1.0.0' } } });
  await session.rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const tools = [];
  let cursor;
  do {
    const page = await session.rpc({ jsonrpc: '2.0', id: ++id, method: 'tools/list', params: cursor ? { cursor } : {} });
    tools.push(...(page.tools ?? []));
    cursor = page.nextCursor;
  } while (cursor);
  return { serverInfo: init.serverInfo ?? {}, instructions: init.instructions ?? '', tools };
}

// ── checks ───────────────────────────────────────────────────────────────────
const len = (s) => (s ?? '').length;
const firstSentence = (d) => (d ?? '').split(/(?<=[.!?])\s|\n/)[0].trim();
const describes = (schema) => { let n = 0; const walk = (o) => { if (o && typeof o === 'object') { if (typeof o.description === 'string') n++; Object.values(o).forEach(walk); } }; walk(schema?.properties ?? {}); return n; };
const outputOnly = (tool) => {
  // Field names described in the output schema but never named in the description.
  const props = tool.outputSchema?.properties ?? {};
  const desc = tool.description ?? '';
  return Object.entries(props).filter(([k, v]) => v && v.description && !desc.includes(k)).map(([k]) => k);
};
const appOnly = (t) => Array.isArray(t._meta?.ui?.visibility) && t._meta.ui.visibility.every((v) => v === 'app');

function analyse(server) {
  const tools = server.tools.filter((t) => !appOnly(t)).map((t) => {
    const d = len(t.description);
    const schemaChars = JSON.stringify(t.inputSchema ?? {}).length;
    const nDescribes = describes(t.inputSchema);
    const out = t.outputSchema ? JSON.stringify(t.outputSchema).length : 0;
    const outOnly = t.outputSchema ? outputOnly(t) : [];
    const ann = t.annotations ?? {};
    const annMissing = ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'].filter((k) => ann[k] === undefined);
    const perClient = {};
    for (const [key, c] of Object.entries(CLIENTS)) {
      const issues = [];
      if (c.desc && d > c.desc) issues.push(`description ${d.toLocaleString('en')} > ${c.desc.toLocaleString('en')}: ${(d - c.desc).toLocaleString('en')} chars (${Math.round((100 * (d - c.desc)) / d)}%) not delivered on the strictest client`);
      if (c.schema && schemaChars > c.schema && nDescribes > 0) issues.push(`input schema ${schemaChars.toLocaleString('en')} > ${c.schema.toLocaleString('en')}: all ${nDescribes} parameter describes dropped on Codex / ChatGPT Work`);
      const reviews = [];
      if (!c.output && outOnly.length) reviews.push(`${outOnly.length} output-schema describe(s) never delivered here (${outOnly.slice(0, 4).join(', ')}${outOnly.length > 4 ? ', …' : ''}): check each meaning also travels in the field name or the response`);
      perClient[key] = { status: issues.length ? 'red' : reviews.length ? 'amber' : 'green', issues, reviews };
    }
    return { name: t.name, title: t.title ?? t.annotations?.title, descriptionChars: d, firstSentence: firstSentence(t.description), inputSchemaChars: schemaChars, parameterDescribes: nDescribes, outputSchemaChars: out, outputOnlyFields: outOnly, annotationsMissing: annMissing, perClient };
  });
  const instr = len(server.instructions);
  const instrByClient = {};
  for (const key of Object.keys(CLIENTS)) instrByClient[key] = { status: instr === 0 ? 'green' : instr > INSTR_SOFT[key] ? 'red' : 'amber', note: instr === 0 ? 'none shipped' : instr > INSTR_SOFT[key] ? `${instr.toLocaleString('en')} > ${INSTR_SOFT[key].toLocaleString('en')}` : `${instr.toLocaleString('en')} ≤ ${INSTR_SOFT[key].toLocaleString('en')}` };
  const listChars = JSON.stringify(server.tools).length;
  const descTotal = tools.reduce((n, t) => n + t.descriptionChars, 0);
  const instructionsHeavy = instr > 512 && instr > descTotal;
  const worst = (...st) => (st.includes('red') ? 'red' : st.includes('amber') ? 'amber' : 'green');
  const n = tools.length;
  const summary = {};
  for (const [key, c] of Object.entries(CLIENTS)) {
    const descOver = c.desc ? tools.filter((t) => t.descriptionChars > c.desc) : [];
    const schemaOver = c.schema ? tools.filter((t) => t.inputSchemaChars > c.schema && t.parameterDescribes > 0) : [];
    const withOutput = tools.filter((t) => t.outputSchemaChars);
    const outReview = c.output ? [] : tools.filter((t) => t.outputOnlyFields.length);
    const i = instrByClient[key];
    const surfaces = {
      description: {
        status: descOver.length ? 'red' : 'green',
        cell: c.desc ? `${descOver.length} of ${n} over ${c.desc.toLocaleString('en')}` : 'no cut measured',
        tools: descOver.map((t) => t.name),
      },
      instructions: {
        status: instructionsHeavy ? 'red' : i.status,
        cell: instr === 0 ? 'none shipped' : `${i.note}${instructionsHeavy ? '; the guidance lives here' : ''}; some clients deliver none`,
      },
      inputSchema: {
        status: schemaOver.length ? 'red' : 'green',
        cell: c.schema ? `${schemaOver.length} of ${n} over ${c.schema.toLocaleString('en')}${schemaOver.length ? ' (describes dropped)' : ''}` : 'delivered whole',
        tools: schemaOver.map((t) => t.name),
      },
      outputSchema: {
        status: outReview.length ? 'amber' : 'green',
        cell: !withOutput.length ? 'none shipped' : c.output ? `${withOutput.length} of ${n} shipped; delivered on Codex and Work` : `${withOutput.length} of ${n} shipped, never delivered${outReview.length ? `; ${outReview.length} carry meaning to check` : ''}`,
        tools: outReview.map((t) => t.name),
      },
    };
    const toolsFailing = tools.filter((t) => t.perClient[key].status === 'red').length;
    const verdict = worst(...Object.values(surfaces).map((x) => x.status));
    summary[key] = { verdict, surfaces, toolsFailing, tools: n };
  }
  return { server: server.serverInfo, instructionsChars: instr, instructions: instrByClient, instructionsHeavy, descriptionCharsTotal: descTotal, toolsListChars: listChars, tools, summary };
}

// ── report ───────────────────────────────────────────────────────────────────
const dot = { green: '🟢', amber: '🟡', red: '🔴' };
function markdown(r, target) {
  const o = [];
  o.push(`# MCP compatibility check — ${r.server.name ?? target} ${r.server.version ?? ''}`.trim(), '');
  o.push(`Target: \`${target}\` · ${r.tools.length} model-visible tools · tools/list ${r.toolsListChars.toLocaleString('en')} chars (re-sent every turn) · instructions ${r.instructionsChars.toLocaleString('en')} chars`, '');
  const cols = Object.keys(CLIENTS);
  o.push('## Verdict', '', '| | ' + cols.map((k) => CLIENTS[k].label).join(' | ') + ' |', '|---|' + cols.map(() => '---').join('|') + '|');
  const SURF = [['description', 'tool description'], ['instructions', 'server instructions'], ['inputSchema', 'input schema'], ['outputSchema', 'output schema']];
  const overall = (k) => {
    const sm = r.summary[k];
    const bad = SURF.filter(([key]) => sm.surfaces[key].status === sm.verdict && sm.verdict !== 'green').map(([, l]) => l);
    return `${dot[sm.verdict]} **${sm.verdict === 'green' ? 'portable' : (sm.verdict === 'red' ? 'not portable: ' : 'host-dependent: ') + bad.join(', ')}** · ${sm.toolsFailing} of ${sm.tools} tools affected`;
  };
  o.push('| **overall** | ' + cols.map(overall).join(' | ') + ' |');
  for (const [key, label] of SURF)
    o.push(`| ${label} | ` + cols.map((k) => `${dot[r.summary[k].surfaces[key].status]} ${r.summary[k].surfaces[key].cell}`).join(' | ') + ' |');
  o.push('', '🟢 portable under the measured limits · 🟡 host-dependent: arrives on some clients, or is never needed; review it · 🔴 not portable: relies on a surface or size that some measured client in that column does not deliver.', '', '_A portability finding, not a quality rating: a protocol-correct server can still be red._', '');
  if (r.instructionsHeavy) o.push(`🔴 **The guidance lives in the server instructions** (${r.instructionsChars.toLocaleString('en')} chars, against ${r.descriptionCharsTotal.toLocaleString('en')} in all tool descriptions together). On claude.ai chat and ChatGPT Work none of it reaches the model; move each rule into the description head of the tool it governs.`, '');
  else if (r.instructionsChars) o.push('Server instructions reach no model on claude.ai chat or ChatGPT Work: every rule in them must also be in a description head or a response.', '');
  const reds = r.tools.filter((t) => t.perClient.all.status === 'red').sort((a, b) => b.perClient.all.issues.length - a.perClient.all.issues.length || b.descriptionChars - a.descriptionChars);
  if (reds.length) {
    o.push('## Start here (all clients)', '');
    for (const t of reds.slice(0, 3)) o.push(`- **\`${t.name}\`**: ${t.perClient.all.issues.join('; ')}`);
    o.push('');
  }
  const ambers = r.tools.filter((t) => t.perClient.all.reviews.length);
  if (ambers.length) {
    o.push('## To review', '');
    for (const t of ambers.slice(0, 5)) o.push(`- \`${t.name}\`: ${t.perClient.all.reviews.join('; ')}`);
    o.push('');
  }
  o.push('## Per tool', '', '| tool | description | input schema | describes | output schema | Claude | ChatGPT/Codex | all |', '|---|---:|---:|---:|---:|:-:|:-:|:-:|');
  for (const t of r.tools) o.push(`| \`${t.name}\` | ${t.descriptionChars.toLocaleString('en')} | ${t.inputSchemaChars.toLocaleString('en')} | ${t.parameterDescribes} | ${t.outputSchemaChars ? t.outputSchemaChars.toLocaleString('en') : '—'} | ${dot[t.perClient.claude.status]} | ${dot[t.perClient.openai.status]} | ${dot[t.perClient.all.status]} |`);
  o.push('', '## Also worth a look', '');
  const noAnn = r.tools.filter((t) => t.annotationsMissing.length);
  if (noAnn.length) o.push(`- ${noAnn.length}/${r.tools.length} tools leave annotations implicit (${[...new Set(noAnn.flatMap((t) => t.annotationsMissing))].join(', ')}).`);
  const shortHeads = r.tools.filter((t) => t.firstSentence.length < 25);
  if (shortHeads.length) o.push(`- ${shortHeads.length} tools have a first sentence under 25 chars; on clients that load tools by search (claude.ai, Cowork, Codex, ChatGPT Work) the name and first sentence decide whether the tool is found.`);
  o.push('', '## Rules behind the columns', '', '| surface | Claude only | ChatGPT / Codex only | all clients |', '|---|---|---|---|',
    '| tool description | red if > 2,048 (Claude Code cut) | no limit (none measured) | red if > 2,048 |',
    '| server instructions | red if > 2,048; else amber if any (claude.ai chat delivers none) | red if > 512 (ChatGPT Chat cut); else amber if any (Work delivers none) | red if > 512; else amber if any |',
    '| input schema | no limit (delivered whole up to ~21.7k) | red if serialized > 5,000 and it has describes (Codex cut, bisected; Work consistent) | red if > 5,000 with describes |',
    '| output schema | amber if a field is described only there (never delivered) | green (delivered on Codex and Work) | amber if described only there |',
    '| overall | the worst of the four | the worst of the four | the worst of the four |', '');
  o.push(`- Measured limits: ${HOST_NOTES.desc} ${HOST_NOTES.instr} ${HOST_NOTES.schema} ${HOST_NOTES.output}`);
  o.push('', '_Static check of what the server ships against client limits measured on 2026-09-27. It does not call tools, so response size and response-side meaning are not checked._');
  return o.join('\n') + '\n';
}

// ── main ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const json = argv.includes('--json');
const timeoutS = Number(argv[argv.indexOf('--timeout') + 1]) || 180;
setTimeout(() => { console.error(`no answer within ${timeoutS}s`); process.exit(1); }, timeoutS * 1000).unref();
const headers = {};
for (let i = 0; i < argv.length; i++) if (argv[i] === '--header') { const [k, ...v] = argv[i + 1].split(':'); headers[k.trim()] = v.join(':').trim(); }
let session, target;
if (argv.includes('--stdio')) {
  const rest = argv.slice(argv.indexOf('--') + 1);
  target = rest.join(' ');
  session = stdioSession(rest[0], rest.slice(1));
} else {
  target = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--header' && argv[i - 1] !== '--timeout').pop();
  if (!target) { console.error('usage: check.mjs [--json] [--header "K: V"] <url> | --stdio -- <cmd> [args]'); process.exit(2); }
  session = await httpSession(target, headers);
}
try {
  const report = analyse(await readServer(session));
  process.stdout.write(json ? JSON.stringify(report, null, 1) + '\n' : markdown(report, target));
} catch (e) {
  console.error(`could not read ${target}: ${e.message}`);
  process.exitCode = 1;
} finally {
  await session.close();
}

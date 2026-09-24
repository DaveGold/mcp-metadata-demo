"""Field-reading probe: which fields does a model MISREAD from the name and value alone?

Hand a fresh, tool-less model one real tool response (guidance stripped), ask it per field what
the value is, its unit and its kind, and score that against a ground-truth file. A field that is
read right every time needs no explanation; a field that is misread needs a rename or a rule.
It costs a few calls per tool — run it on the weakest model you might be called by.

usage:
  field_probe.py --payload a.json [--payload b.json ...] --truth truth.json --out out_dir
                 [--strip interpretation,derived] [--model haiku] [--repeats 3] [--max-records 3]

truth.json:  {"fields": {"<dotted path>": {"kinds": ["calculated"], "unit": "kwh/m2",
               "meaning": "...", "critical": true}, ...}}
kinds:       register · calculated · measured · computed_by_tool · identifier · metadata
A path like "records.tempMax" is read from the first --max-records rows of an array.
"""
import argparse, json, os, re, subprocess, sys, tempfile
from collections import defaultdict

KINDS = 'register, calculated, measured, computed_by_tool, identifier, metadata'
PROMPT = """You are reading one response from a data tool. For EACH field path listed at the end,
say what its value means, its unit, and its kind. Use only this JSON; do not call any tools.

Kinds:
- register: a fact recorded in an official register
- calculated: computed by a modelling or labelling method, NOT measured
- measured: observed or measured
- computed_by_tool: derived by the tool itself from other values
- identifier: an id or code
- metadata: status, dates, flags or counts about the record or the query

Return ONLY a JSON array, one object per field path, no prose:
[{{"field": "<path>", "meaning": "<= 15 words", "unit": "<unit or none>", "kind": "<one kind>", "if_null": "<what null means here, or empty>"}}]

RESPONSE:
{payload}

FIELD PATHS:
{paths}"""

def norm_unit(u):
    u = (u or '').lower().replace('²', '2').replace(' ', '').replace('^', '')
    u = re.sub(r'/(yr|year|jaar|a)$', '', u)
    u = u.replace('squaremetres', 'm2').replace('squaremeters', 'm2').replace('percent', '%').replace('degrees', 'degrees')
    u = u.replace('/y', '').replace('perm2', '/m2').replace('kwhperm2', 'kwh/m2')
    if u in ('', 'none', 'n/a', 'na', '-', 'unitless', 'dimensionless', 'ratio', 'text', 'string', 'boolean', 'bool', 'code', 'id'): return 'none'
    return u

def unit_ok(got, want):
    g, w = norm_unit(got), norm_unit(want)
    if w == 'none': return g == 'none'
    if w == 'count': return g in ('none', 'count', 'units', 'number') or 'count' in g
    if w == 'year': return g in ('year', 'none') or 'year' in g
    if w == 'date': return 'date' in g or g in ('none', 'iso8601', 'yyyy-mm-dd')
    if w == 'degrees': return 'deg' in g or '°' in g
    if w.startswith('°c'): return ('°c' in g or 'celsius' in g or 'degc' in g or 'degree' in g) and (('day' in g) == ('day' in w))
    return w in g or g in w

def kind_accepts(kinds, got):
    # "calculated" and "computed_by_tool" both mean derived-not-observed. They are kept apart only
    # where the difference matters: a field computed by an EXTERNAL method (a label) must not be
    # called tool-derived. So a truth that allows computed_by_tool also accepts calculated.
    return got in kinds or ('computed_by_tool' in kinds and got == 'calculated')

def pick(payload, path, max_records):
    cur = [payload]
    for part in path.split('.'):
        nxt = []
        for c in cur:
            if isinstance(c, list): c = c[:max_records]; nxt += [x.get(part) for x in c if isinstance(x, dict)]
            elif isinstance(c, dict): nxt.append(c.get(part))
        cur = nxt
    return cur

def rescore(path, truth):
    d = json.load(open(path))
    for f, rs in d['runs'].items():
        for r in rs:
            t = truth[f]; r['kind_ok'] = kind_accepts(t['kinds'], r['kind']); r['unit_ok'] = unit_ok(r['unit'], t['unit'])
    return d['runs']

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--payload', action='append', default=[])
    ap.add_argument('--truth', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--strip', default='interpretation,derived'); ap.add_argument('--model', default='haiku')
    ap.add_argument('--repeats', type=int, default=3); ap.add_argument('--max-records', type=int, default=3)
    ap.add_argument('--rescore', action='store_true', help='re-score <out>/field_probe.json with the current matcher; no model calls')
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    truth = json.load(open(a.truth))['fields']
    results = defaultdict(list)
    if a.rescore:
        results.update(rescore(os.path.join(a.out, 'field_probe.json'), truth)); a.payload = []
    for pf in a.payload:
        p = json.load(open(pf))
        for k in a.strip.split(','):
            p.pop(k, None)
        for k, v in list(p.items()):
            if isinstance(v, list): p[k] = v[:a.max_records]
        paths = [f for f in truth if any(v is not None for v in pick(p, f, a.max_records)) or f in p]
        prompt = PROMPT.format(payload=json.dumps(p, ensure_ascii=False, indent=1), paths='\n'.join(paths))
        for rep in range(a.repeats):
            with tempfile.TemporaryDirectory() as empty:   # no project files, no MCP servers, no tools
                r = subprocess.run(['claude', '-p', prompt, '--model', a.model, '--output-format', 'json', '--tools', '',
                                    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'], cwd=empty, capture_output=True, text=True)
            try:
                text = json.loads(r.stdout)['result']; arr = json.loads(text[text.index('['): text.rindex(']') + 1])
            except Exception as e:
                print('unparseable run', pf, rep, e, file=sys.stderr); continue
            got = {x.get('field'): x for x in arr}
            for f in paths:
                t = truth[f]; x = got.get(f) or {}
                kind_ok = kind_accepts(t['kinds'], x.get('kind'))
                measured_misread = 'calculated' in t['kinds'] and 'measured' not in t['kinds'] and x.get('kind') == 'measured'
                results[f].append(dict(payload=os.path.basename(pf), rep=rep, kind=x.get('kind'), unit=x.get('unit'), meaning=x.get('meaning'),
                                       if_null=x.get('if_null'), kind_ok=kind_ok, unit_ok=unit_ok(x.get('unit'), t['unit']), measured_misread=measured_misread, missing=not x))
    summary = {}
    for f, rs in results.items():
        n = len(rs); t = truth[f]
        summary[f] = dict(n=n, kind_ok=sum(r['kind_ok'] for r in rs), unit_ok=sum(r['unit_ok'] for r in rs),
                          measured_misread=sum(r['measured_misread'] for r in rs), missing=sum(r['missing'] for r in rs), critical=t.get('critical', False),
                          verdict='READ RIGHT' if all(r['kind_ok'] and r['unit_ok'] for r in rs) else ('MISREAD' if any(r['measured_misread'] for r in rs) or sum(not (r['kind_ok'] and r['unit_ok']) for r in rs) > n / 3 else 'MOSTLY RIGHT'))
    json.dump(dict(summary=summary, runs=results), open(os.path.join(a.out, 'field_probe.json'), 'w'), indent=1, ensure_ascii=False)
    for f, s in sorted(summary.items(), key=lambda kv: (kv[1]['verdict'] != 'MISREAD', kv[1]['verdict'] != 'MOSTLY RIGHT', kv[0])):
        print(f"{s['verdict']:13} {f:58} kind {s['kind_ok']}/{s['n']}  unit {s['unit_ok']}/{s['n']}" + (f"  MEASURED x{s['measured_misread']}" if s['measured_misread'] else '') + ('  [critical]' if s['critical'] else ''))

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Q18: does an IMPROVING agent edit better from field-keyed semantics?

Design-time, not runtime: no MCP server is involved. Each run is one headless
`claude -p` call with no tools and no settings, from an empty directory, given
the output-field list, the semantics source in one of three forms, and one task.

  A  prose          the INTERPRETATION bullets as they are today
  B  structured     { tool, relates_to_fields, meaning, provenance } records
  C  prose + same   A's bullets with the SAME field list and provenance as B,
                    written as sentences. B vs C is form; C vs A is content.

Sizes: small = the 32 real rules; large = those plus the 80 padding rules.

  python3 evals/q18/q18.py render            write the six sources to evals/q18/sources/
  python3 evals/q18/q18.py run OUT_DIR       run every cell (skips runs already in OUT_DIR)
  python3 evals/q18/q18.py score OUT_DIR     print the scores
"""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
RULES = json.loads((HERE / 'rules.json').read_text())['rules']
TASKS = json.loads((HERE / 'tasks.json').read_text())
ARMS, SIZES, MODELS = ['A', 'B', 'C'], ['small', 'large'], ['sonnet', 'opus']
BP_HEADER = 'Which fields are populated depends on the berekeningstype:'
BP_FIELDS = ('matchStatus candidateCount labelCount adres gemeente provincie oppervlakte_m2 gebruiksdoel '
             'coordinaten.lat coordinaten.lon bag_vbo_id vbo_status bouwjaar pand_status aantal_verblijfsobjecten '
             'bag_pand_id energielabel ep1_energiebehoefte_kwh_m2 ep2_fossiel_kwh_m2 aandeel_hernieuwbaar_pct '
             'co2_emissie_kg_m2 berekend_energieverbruik_kwh_m2 warmtebehoefte_kwh_m2 temperatuuroverschrijding '
             'compactheid gebruiksoppervlakte_thermische_zone_m2 gebouwklasse soort_opname berekeningstype label_status '
             'op_basis_van_referentiegebouw label_geldig_tot label_opnamedatum label_registratiedatum gebouwtype '
             'gebouwsubtype sbi_code energie_index ep2_fossiel_emg_forfaitair_kwh_m2 aandeel_hernieuwbaar_emg_forfaitair_pct '
             'eis_energiebehoefte_kwh_m2 eis_primaire_fossiele_energie_kwh_m2 eis_aandeel_hernieuwbare_energie_pct '
             'certificaathouder ep_online_bouwjaar').split()
WX_FIELDS = ('recordCount location.latitude location.longitude location.note period.dateFrom period.dateTo period.days '
             'period.measuredDays period.forecastDays period.archiveLagNote temperature.periodMean temperature.periodMin '
             'temperature.periodMax temperature.coldestDay temperature.hottestDay degreeDays.totalHDD '
             'degreeDays.totalWeightedHDD degreeDays.totalCDD degreeDays.referenceAnnualHDD gasNormalizationFactor '
             'solarRadiation totalSunshineDurationHours monthlyBreakdown[].month monthlyBreakdown[].weightedHDD '
             'monthlyBreakdown[].avgTempMean records[].date records[].tempMean records[].tempMin records[].tempMax '
             'records[].hdd records[].cdd records[].weightedHdd records[].sunshineDurationHours records[].weatherCode '
             'records[].weatherLabel records[].isForecast interpretation.alerts').split()


def rules_for(size):
    return [r for r in RULES if size == 'large' or r['set'] == 'real']


def groups(rules):
    """Real building-profile rules, real weather rules, then padding per tool, in fixture order."""
    order = []
    for r in rules:
        key = (r['tool'], r['set'])
        if key not in order:
            order.append(key)
    return [(k, [r for r in rules if (r['tool'], r['set']) == k]) for k in order]


def fields_sentence(fs):
    if not fs:
        return 'This rule names no output field.'
    return 'This rule concerns ' + ', '.join('`%s`' % f for f in fs) + '.'


def render(arm, size):
    rules = rules_for(size)
    out = []
    if arm == 'B':
        out.append('// src/semantics.ts: every interpretation rule the tools deliver, one record per rule.')
        out.append('export const semantics: FieldRule[] = [')
        for r in rules:
            out.append('  {')
            out.append('    tool: %s,' % json.dumps(r['tool']))
            out.append('    relates_to_fields: %s,' % json.dumps(r['relates_to_fields']))
            out.append('    meaning: %s,' % json.dumps(r['text'], ensure_ascii=False))
            out.append('    provenance: %s,' % json.dumps(r['provenance'], ensure_ascii=False))
            out.append('  },')
        out.append('];')
        return '\n'.join(out)
    for (tool, kind), rs in groups(rules):
        title = 'INTERPRETATION' if kind == 'real' else 'GUIDANCE'
        out.append('// %s: %s block of the tool description' % (tool, title))
        out.append(title + ':')
        if tool == 'get_building_profile' and kind == 'real':
            out.append(BP_HEADER)
        for r in rs:
            line = '- ' + r['text']
            if arm == 'C':
                line += ' ' + fields_sentence(r['relates_to_fields']) + ' History: ' + r['provenance']
            out.append(line)
        out.append('')
    return '\n'.join(out).rstrip()


PROMPT = """You are the agent in the improvement loop of an MCP server (Examine, Flag, Validate, Encode, Iterate). Below are (1) the output fields the server's two data tools return, and (2) the server's semantics source: every interpretation rule the tools deliver to the model. Work from this material only; you have no other access to the repository, its history or its tests.

=== OUTPUT FIELDS ===
get_building_profile: {bp}
get_weather_context: {wx}

=== SEMANTICS SOURCE ===
{source}

=== TASK ===
{task}

End your answer with one fenced ```json block in exactly this shape:
{shape}
Whenever you quote a rule, copy its first ten words verbatim from the semantics source."""


def prompt(arm, size, task):
    return PROMPT.format(bp=', '.join(BP_FIELDS), wx=', '.join(WX_FIELDS), source=render(arm, size),
                         task=task['prompt'], shape=task['shape'])


def cells():
    for model in MODELS:
        for size in SIZES:
            for arm in ARMS:
                for t in TASKS['tasks']:
                    for rep in range(TASKS['reps'][t['type']]):
                        yield dict(model=model, size=size, arm=arm, task=t['id'], rep=rep,
                                   run_id='%s-%s-%s-%s-r%d' % (model, size, arm, t['id'], rep))


def run_one(c, out_dir, work_dir):
    path = out_dir / (c['run_id'] + '.json')
    if path.exists():
        return
    t = next(t for t in TASKS['tasks'] if t['id'] == c['task'])
    p = subprocess.run(['claude', '-p', '--model', c['model'], '--tools', '', '--setting-sources', '',
                        '--strict-mcp-config', '--no-session-persistence', '--output-format', 'json'],
                       input=prompt(c['arm'], c['size'], t), capture_output=True, text=True, cwd=work_dir,
                       timeout=600)
    try:
        res = json.loads(p.stdout)
    except json.JSONDecodeError:
        res = {'is_error': True, 'raw_stdout': p.stdout[-2000:], 'stderr': p.stderr[-2000:]}
    if res.get('is_error'):
        print('ERROR', c['run_id'], str(res)[:300], flush=True)
        return
    path.write_text(json.dumps({**c, 'result': res}, ensure_ascii=False, indent=1))
    print('ok', c['run_id'], flush=True)


# ── scoring ──────────────────────────────────────────────────────────────────

def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', s.lower()).strip()


def match_rule(quote, rules):
    """The rule whose text contains the quoted words; else the best word-overlap match at >= 0.6."""
    q = norm(quote)
    if not q:
        return None
    for r in rules:
        if q in norm(r['text']) or q in norm(BP_HEADER + ' ' + r['text']):
            return r['id']
    qw = q.split()
    best, score = None, 0.0
    for r in rules:
        tw = norm(r['text']).split()[:len(qw) + 4]
        ov = sum(1 for w in qw if w in tw) / len(qw)
        if ov > score:
            best, score = r['id'], ov
    return best if score >= 0.6 else None


def answer_json(text):
    m = re.findall(r'```json\s*(\{.*?\})\s*```', text, re.S)
    if not m:
        return None
    try:
        return json.loads(m[-1])
    except json.JSONDecodeError:
        return None


def truth_rules(size, changed):
    return {r['id'] for r in rules_for(size) if set(r['relates_to_fields']) & set(changed)}


def uncovered(size, tool_fields):
    covered = {f for r in rules_for(size) for f in r['relates_to_fields']}
    return {f for f in tool_fields if f not in covered}


def score_run(run):
    t = next(t for t in TASKS['tasks'] if t['id'] == run['task'])
    rules = rules_for(run['size'])
    text = run['result'].get('result', '')
    a = answer_json(text)
    s = {'parsed': a is not None}
    if a is None:
        return s
    if t['type'] == 'T1':
        tr = t['truth']
        got_fields = {str(f).split('.')[-1] for f in a.get('fields', [])}
        matched = {match_rule(q, rules) for q in a.get('existing_rules', [])} - {None}
        s['field_ok'] = bool(got_fields & set(tr['primary_fields']))
        s['fix_ok'] = a.get('fix') == tr['fix']
        s['rule_ok'] = (not tr['key_rules_any']) or bool(matched & set(tr['key_rules_any']))
        s['correct'] = s['field_ok'] and s['fix_ok'] and s['rule_ok']
        s['matched'] = sorted(matched)
    elif t['type'] == 'T2':
        truth = truth_rules(run['size'], t['changed_fields'])
        got = {match_rule(q, rules) for q in a.get('rules_to_update', [])}
        s['unmatched_quotes'] = sum(1 for g in got if g is None)
        got -= {None}
        tp = len(got & truth)
        s['recall'] = tp / len(truth)
        s['precision'] = tp / len(got) if got else 0.0
        s['exact'] = got == truth
        s['missed'], s['extra'] = sorted(truth - got), sorted(got - truth)
    elif t['type'] == 'T3':
        excl = set(t['borderline_excluded'])
        scope = [f for f in BP_FIELDS if f not in excl]
        truth = uncovered(run['size'], scope)
        got = {str(f).strip('`') for f in a.get('fields_without_rules', [])} & set(scope)
        tp = len(got & truth)
        p = tp / len(got) if got else 0.0
        r = tp / len(truth)
        s['precision'], s['recall'] = p, r
        s['f1'] = 2 * p * r / (p + r) if p + r else 0.0
        s['missed'], s['extra'] = sorted(truth - got), sorted(got - truth)
    elif t['type'] == 'T4':
        rr = a.get('recorded_reason')
        s['recorded_reason'] = rr
        s['recommendation'] = a.get('recommendation')
        s['cites_evidence'] = bool(rr) and any(pat.lower() in str(rr).lower() for pat in t['truth']['evidence_patterns'])
    usage = run['result'].get('usage', {})
    s['output_tokens'] = usage.get('output_tokens')
    s['duration_ms'] = run['result'].get('duration_ms')
    s['cost_usd'] = run['result'].get('total_cost_usd')
    return s


def main():
    cmd = sys.argv[1]
    if cmd == 'render':
        d = HERE / 'sources'
        d.mkdir(exist_ok=True)
        for arm in ARMS:
            for size in SIZES:
                (d / ('%s-%s.txt' % (arm, size))).write_text(render(arm, size) + '\n')
        print('rendered', len(ARMS) * len(SIZES), 'sources;', sum(1 for _ in cells()), 'runs planned')
    elif cmd == 'run':
        out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
        work = out / 'empty-cwd'; work.mkdir(exist_ok=True)
        todo = [c for c in cells() if not (out / (c['run_id'] + '.json')).exists()]
        workers = int(os.environ.get('Q18_WORKERS', '6'))
        with ThreadPoolExecutor(workers) as ex:
            list(ex.map(lambda c: run_one(c, out, work), todo))
    elif cmd == 'score':
        out = Path(sys.argv[2])
        runs = [json.loads(p.read_text()) for p in sorted(out.glob('*.json'))]
        scored = [{**{k: r[k] for k in ('run_id', 'model', 'size', 'arm', 'task', 'rep')}, **score_run(r)} for r in runs]
        json.dump(scored, sys.stdout, ensure_ascii=False, indent=1)
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()

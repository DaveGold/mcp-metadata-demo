"""Exit 0 if a wave is complete and clean; otherwise 1. A wave with ANY missing run, rate-limited call or
tool-less subagent is discarded WHOLE and re-run, so every comparison stays inside one batch.
   usage: check_wave.py <waves.json> <wave> <out-dir>"""
import json,sys
WAVES,W,OUT=sys.argv[1],int(sys.argv[2]),sys.argv[3]
wave=[x for x in json.load(open(WAVES)) if x['wave']==W][0]
rows=[json.loads(l) for l in open(f'{OUT}/rows.jsonl') if json.loads(l)['wave']==W]
bad=len(rows)!=len(wave['arms']) or any(r.get('error') or not r.get('output') or any(c.get('rate_limited') for c in r.get('calls',[])) for r in rows)
sys.exit(1 if bad else 0)

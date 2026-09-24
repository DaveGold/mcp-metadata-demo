"""Read one wave's results from the headless parent's transcript (not from the models' self-reports).
   usage: extract.py <waves.json> <wave> <repo-dir> <out-dir>   -> rewrites that wave's rows in <out-dir>/rows.jsonl
Per run: the verbatim answer, the harness metrics (tool uses, tokens, duration) and every MCP call with
its input, result size, error flag, and whether it hit a rate limit or a host file-notice."""
import json,sys,os,re
WAVES,W,REPO,OUT=sys.argv[1],int(sys.argv[2]),os.path.abspath(sys.argv[3]),sys.argv[4]
wave=[x for x in json.load(open(WAVES)) if x['wave']==W][0]
sid=json.load(open(f'{OUT}/wave{W}.json'))['session_id']
proj=os.path.expanduser('~/.claude/projects/'+re.sub(r'[/.]','-',REPO))
LIMIT=re.compile(r'too many (concurrent )?requests|API request limit exceeded|rate limit',re.I)
uses={};order=[];res={}
for line in open(f'{proj}/{sid}.jsonl'):
    d=json.loads(line)
    if d.get('type')=='assistant':
        for b in d['message']['content']:
            if b.get('type')=='tool_use' and b['name']=='Agent': uses[b['id']]=b['input'];order.append(b['id'])
    if d.get('type')=='user' and isinstance(d.get('toolUseResult'),dict):
        for b in d['message']['content']:
            if isinstance(b,dict) and b.get('type')=='tool_result': res[b['tool_use_id']]=d['toolUseResult']
def calls(agent):
    out=[];results={}
    for line in open(f'{proj}/{sid}/subagents/agent-{agent}.jsonl'):
        d=json.loads(line)
        if d.get('type')=='assistant':
            for b in d['message']['content']:
                if b.get('type')=='tool_use': out.append({'id':b['id'],'name':b['name'].split('__')[-1],'server':b['name'].split('__')[1] if b['name'].startswith('mcp__') else None,'input':b['input']})
        if d.get('type')=='user' and isinstance(d['message']['content'],list):
            for b in d['message']['content']:
                if isinstance(b,dict) and b.get('type')=='tool_result':
                    t=b['content'] if isinstance(b['content'],str) else ''.join(x.get('text','') for x in b['content'] if isinstance(x,dict))
                    results[b['tool_use_id']]=dict(result_chars=len(t),error=bool(b.get('is_error')),rate_limited=bool(LIMIT.search(t)),file_notice='saved to' in t.lower() and len(t)<4000)
    for c in out: c.update(results.get(c.pop('id'),{}))
    return out
rows=[]
for k,tid in enumerate(order,1):
    r=res.get(tid);i=uses[tid]
    base=dict(wave=W,slot=k,arm=i['subagent_type'][5:],model_req=i.get('model'),prompt_ok=i['prompt'].strip()==wave['question'].strip(),parent_session=sid,**{x:wave[x] for x in wave if x not in('wave','arms','question')})
    if r is None: rows.append({**base,'error':'no result'});continue
    text=''.join(x.get('text','') for x in r['content'] if x.get('type')=='text')
    rows.append({**base,'model':r.get('resolvedModel'),'agentId':r['agentId'],'tool_uses':r['totalToolUseCount'],'duration_ms':r['totalDurationMs'],'subagent_tokens':r['totalTokens'],'output':text,'calls':calls(r['agentId'])})
path=f'{OUT}/rows.jsonl'
keep=[l for l in open(path)] if os.path.exists(path) else []
keep=[l for l in keep if json.loads(l)['wave']!=W]          # idempotent per wave
open(path,'w').writelines(keep+[json.dumps(x,ensure_ascii=False)+'\n' for x in rows])
print('wave',W,'rows',len(rows),'of',len(wave['arms']))

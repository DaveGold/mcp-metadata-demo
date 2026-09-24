#!/bin/zsh
# One eval wave: a fresh headless Claude Code parent spawns the eval subagents in parallel.
#   usage: run_wave.sh <waves.json> <wave-number> <repo-dir> <out-dir>
# waves.json: [{ "wave": 1, "model": "haiku", "question": "...", "arms": ["new","old","new","old"] }, ...]
# Each arm needs .claude/agents/eval-<arm>.md whose tools are ONLY mcp__eval-<arm>__* and an
# .mcp.json entry "eval-<arm>". A fresh parent loads the CURRENT .mcp.json (a running session may not).
set -u
WAVES=$1; W=$2; REPO=$3; OUT=$4; mkdir -p $OUT
eval "$(python3 - "$WAVES" "$W" <<'PY'
import json,sys,shlex
w=[x for x in json.load(open(sys.argv[1])) if x['wave']==int(sys.argv[2])][0]
arms=w['arms']
lines=''.join(f'{i}. subagent_type="eval-{a}", model="{w["model"]}", run_in_background=false, description="run {i}"\n' for i,a in enumerate(arms,1))
sel=",".join(sorted({f"mcp__eval-{a}__{w.get('probe_tool','get_building_profile')}" for a in arms}))
allow='Agent,ToolSearch,'+','.join(sorted({f'mcp__eval-{a}' for a in arms}))
prompt=f"""You are orchestrating one wave of an evaluation. FIRST make one ToolSearch call with query "select:{sel}" and max_results 5 (this waits for the MCP servers to connect). If that result does not list every one of those tools, call ToolSearch again with the same query, up to 3 more times. THEN, in a SINGLE assistant message, make exactly {len(arms)} Agent tool calls in parallel, in this order, with these exact parameters:

{lines}
Every one of the calls gets exactly this prompt, character for character, and nothing else — no preamble, no context, no instructions:

{w['question']}

Do not call any other tool besides those ToolSearch calls. Do not retry any call. When all calls have returned, reply with the single word DONE."""
print('PROMPT='+shlex.quote(prompt)); print('ALLOW='+shlex.quote(allow))
PY
)"
cd $REPO
touch $OUT/wave$W.start          # file mtimes are the audit window (macOS date has no %N)
# Unset the description cap so every wave runs at the host default; set it explicitly to test a cap.
env -u CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH claude -p "$PROMPT" --model ${PARENT_MODEL:-sonnet} \
  --output-format json --allowedTools "$ALLOW" < /dev/null > $OUT/wave$W.json 2> $OUT/wave$W.err
RC=$?; touch $OUT/wave$W.end; echo "wave $W exit $RC"

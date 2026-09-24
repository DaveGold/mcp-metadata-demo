# Recording — where each kind of knowledge is written down

Discovery that is not written down is re-discovered next quarter. Discovery written down in the
wrong place is worse: it looks recorded and never reaches the model or the next maintainer.

Two readers, two destinations:

- **The model answering a user** reads only what is delivered: field names, the description head,
  the input schema and the response ([`delivery.md`](delivery.md)).
- **The agent or person improving the server** reads the source, the findings doc and the eval
  record. For them the one thing that changes decisions is **provenance** — why a rule exists
  [Q18].

---

## The map

| knowledge | where | form | read by |
|---|---|---|---|
| What a value IS (quantity, scope, provenance, unit) | the **field name** | `ep1_energiebehoefte_berekend_kwh_m2` | model |
| Renames of upstream fields | `FIELD_NAMES` table in source (e.g. [`best-field-names.ts`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/domain/best-field-names.ts)) | `{ upstream, name, reason, provenance }` | maintainer |
| What the tool is/is not, input conventions, record-independent rules | description head (≤ 2,048) | prose, fact + instruction per rule | model |
| Formats, valid values, misbehaving params, valid `select` names | input schema `.describe()`/`.meta()` | one sentence + a working example | model |
| Rules that interpret returned values | **rule registry** in source (e.g. [`best-building-rules.ts`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/domain/best-building-rules.ts)) | `{ id, relates_to_fields, applies, render, provenance }` | maintainer: all of it, in source. Model: **only the line `render()` returns**, in `interpretation` — `relates_to_fields` and `provenance` are never serialized |
| Determinate derived values and verdicts | `transform` / `summarize` code | computed field with `unit`, `basis`, `provenance`, or `null` + `reason` | model |
| Constants the model needs (conversion factors, thresholds) | `interpretation.constants` in the response, defined once in source | named constant with its source in a comment | both |
| API behaviour, quirks, null patterns, broken endpoints | `docs/<name>-findings.md` | dated section, reproduction command per claim | maintainer |
| Open questions | inline `[CONFIDENCE: … TODO: DOMAIN EXPERT — …]` **and** the findings doc | removed from the code when answered | maintainer, expert |
| Expert answers | findings doc → *Resolved gaps* / *Decisions confirmed* | date + who answered + verbatim answer | maintainer |
| Each discovered quirk and each rule's behaviour | a unit test | pins vendor behaviour and the rule's output | CI |
| Wire surface of a variant that has been measured | a hash snapshot test (e.g. [`arms-frozen.test.ts`](https://github.com/DaveGold/mcp-metadata-demo/blob/main/src/arms-frozen.test.ts)) | sha256 of `tools/list` + instructions | CI |
| A hypothesis about a metadata change | `evals/open-questions.md` | prediction + what falsifies it, **before** the run | maintainer |
| A measurement | `evals/results/<date>-<slug>.json` | new file per run, never edited; caveats list | maintainer |
| A defect an eval run found (in your tool, not in the model) | findings doc §7 *Known bugs* + the rule's provenance line | what failed, the result that showed it, the repro | maintainer |
| Project conventions (deploy, variants, quirks) | `CLAUDE.md` / `AGENTS.md` | short, operational | coding agents |
| Why this skill says what it says | [`evidence.md`](evidence.md) | one row per rule | whoever edits the skill |

## Provenance — the one field that pays

Q18 gave an improving agent the same 112 rules as prose, as structured records, and as prose with
the same content. It found the rule a failing trace points at, listed the rules a schema change
orphans, and listed uncovered fields equally well from all three (99–100%). Only one thing
changed outcomes: when the rule's recorded history was present, the agent cited it 16/16 and
decided; without it, it re-derived a rationale and asked for the test to be re-run. None invented
a history.

So: **one provenance line per rule, rename and alert** — the date and the eval result, incident or
expert answer behind it. Explicit `relates_to_fields` lists are cheap and still useful — for
coverage and orphan tests, and for links the prose leaves implicit — but they are not what the
maintainer needs, and they do not reach the model. (Selection is `applies`, not the field list.)

Provenance stays in **source**. Nothing measured shows it helps the answering model, and anything
in the response is paid for on every call [Q5].

Good provenance lines:

```
'2026-09-21 benchmark-trap: 0/60 → 59/60 with this sentence; 2026-09-22 Q4: fact 25/30, instruction 10/30, both 30/30'
'2026-09-22 absent-sizing: haiku 18/20 with this note vs 10/20 pruned; sonnet/opus 20/20 either way'
'2026-09-23 audit: upstream name read as measured consumption (evals/README §2); no eval of the rename yet'
```

Bad: `'important'`, `'see docs'`, `'added after feedback'` (whose? when? what happened?).

## The findings doc

Structure (from `discovery.md`), plus one section for audits:

```markdown
# <Server> — findings
<date, environment, who probed, how to reproduce>

## 1. Auth & transport
## 2. Real catalog scope
## 3. Pagination
## 4. Filtering
## 5. Row shape
## 6. Cross-server
## 7. Known bugs
## 8. Re-check when API matures
## 9. Resolved gaps
## 10. Decisions confirmed
## 11. Audits          dated: inventory, name audit, delivery, wrongness — see audit.md
```

Two habits: a **reproduction command** next to every claim, and a **date** on every section. A
finding without a date is indistinguishable from one that has since been fixed.

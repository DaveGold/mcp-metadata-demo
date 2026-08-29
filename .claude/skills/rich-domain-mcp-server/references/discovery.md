# Examine & Flag — interrogating an API until it confesses

The first two steps of the EFVEI loop. **Examine** is the directed interrogation; **Flag** is
tagging every pattern with a confidence level and a question while you find it.

Vendor documentation describes the happy path. Everything that actually breaks an agent — fields
that are null for one record type, parameters the server silently ignores, totals that lie, joins
that only work in one direction — is invisible until you hammer real rows.

Output goes three places: the tool metadata (Encode — see `metadata.md`), the list of open questions
for the expert (Validate — see `validation.md`), and `docs/<name>-api-findings.md`.

---

## Examine through the deployed tools

Build the stub, deploy it, then **open a fresh chat context** and let the agent interrogate the
tools it can now see. This is the default path, not the fallback — most of what you learn comes
from calling your own tool surface, because that is exactly the surface the production agent will
reason over. A quirk that only shows up through the raw HTTP endpoint is interesting; a quirk that
shows up through the tool is a metadata bug.

```
deploy → FRESH context → EXAMINE → FLAG → (VALIDATE) → ENCODE → redeploy → FRESH context → …
```

**Fresh context is mandatory.** Two independent reasons:

1. MCP clients cache the tool catalog per chat session. A newly deployed tool — or a changed
   description — is **not** visible in a running chat, not even after reconnecting the server.
   claude.ai needs the chat closed and reopened; Claude Code needs a restart or `/clear` plus a
   reconnect.
2. An agent that watched you write the description will confirm your assumptions. An agent that
   only sees the deployed metadata will *test* them — and its confusion is the signal you want.

**Run the session as an operator, not a requester.** "Examine the data" produces a summary of the
first page. You give one directed instruction at a time, read the answer, and let it pick the next
question. The default behaviour of any agent is to fetch ten rows and generalise; ten rows are
never representative. The patterns live at the edges.

**Two validation paths, both required.** After a deploy, verify via a direct API/probe call *and*
via MCP. They catch different bugs: a probe script that pre-fetches metadata will pass where the
deployed tool, which doesn't, silently falls back to the wrong aggregation.

---

## The probe matrix

Nine dimensions. Each is a set of variations you push through the same tool. Work down the list;
later dimensions depend on what earlier ones taught you.

### 1. Surface & shape

- Fetch a page. Enumerate **every** key, its type, and whether the type is stable across rows.
- Fetch a second page from a different slice. Do the key sets match? Fields that appear only in
  some rows are conditional — find the condition.
- Compare against the vendor schema: fields documented but never returned, and fields returned but
  undocumented. Both are findings.

### 2. Nullability by slice — the highest-value dimension

Never report "nullable". Report *when* it's null.

- Take ≥200 rows (more if cheap) and count nulls per field. Percentages, not impressions.
- Then **slice by every categorical field you have** (type, status, category, source) and recount.
  A field that is 40% null overall is usually 0% null for one type and 100% for another — that is
  the fact worth writing down.
- Ask the inverse question: take the rows where field X is unexpectedly null, and ask what *else*
  those rows have in common.
- Distinguish `null` / missing key / `""` / `0` / sentinel. They mean different things and agents
  treat them identically unless told.

> Illustrative examples of what this dimension turns up: an "assignee name" field that's always
> null for one record subtype, because the real assignee is only reachable through a different
> tool filtered on that subtype. A date field returning the sentinel `0001-01-01` instead of null.
> A numeric field arriving as `-1.79e+308` when genuinely unavailable, instead of null.

Sample-size discipline: a null claim from <100 rows in one slice is `LOW`. Across ≥3 slices and a
few hundred rows it is `HIGH`.

### 3. Cardinality & enums

- For every code/status/type field: enumerate distinct values and their frequency.
- Look at the **tail**, not the top 5. Rare values are where the business rules hide.
- Is the set closed (a real enum) or open (free text that happens to repeat)? Say which.
- Does a code field have a companion description field? If yes, that is the label — never inline a
  code table in a description (see `metadata.md`, two-layer enrichment).

### 4. Ordering & sortability

- Which fields can you actually sort on? Try each. Note the ones that error and the ones that are
  **silently ignored** — the second kind is dangerous.
- `asc` and `desc` both: sort desc on a numeric/date field and read the top. Outliers surface
  business rules (negative amounts, year 1900, a 400-hour booking).
- Where do nulls land — first or last? It changes what "top 10" means.
- Is ordering **stable** across pages with equal keys? If not, pagination silently drops and
  duplicates rows.
- Is there a *default* order, and is it documented? A catalog that returns supplier-clustered
  ordering by default means walking the unfiltered list never discovers every entry.

### 5. Filter & parameter semantics

- Exercise **every operator** on a field type it isn't meant for. Some REST APIs define numeric
  operator codes that are type-restricted (e.g. a text-only operator applied to a date field
  produces nonsense, not an error).
- Case sensitivity, partial matching, trailing whitespace.
- Empty vs null: does an "is empty" operator match `""`, `null`, or both?
- Date boundaries: does `<=` on a date include the whole day, or does it need an explicit
  `T23:59:59`? Timezone of the API vs of the caller — convert local→UTC explicitly, and check a
  DST transition day if the data is daily.
- **Combination**: two filters — AND or OR? Two filters on the same field — range or contradiction?
- **Silently-ignored parameters are the trap.** Pass a filter and compare the row count to the
  unfiltered call. Equal counts mean the parameter did nothing. Worse than ignored: some APIs have
  a parameter that *zeroes out* the result set instead of being ignored. Both belong in the input
  schema as an explicit warning.

### 6. Pagination & scale

- Max page size, and what happens above it (clamp? error? silent cap?).
- Offset or cursor. If cursor: is it scope-bound (does a cursor from an unfiltered call survive a
  filter?), size-bound (does changing the page size invalidate it?), and how long does it live?
  Some cursors expire in under a minute.
- Walk to the end. Does the last page behave? Do totals add up to the reported total?
- **Do reported totals lie?** Check a "total" against a counted walk. A cache-artefact
  `estimatedTotal` reporting an order of magnitude more than the real catalog size is a real,
  recurring failure mode — worth checking for specifically.
- What does deep pagination cost? If an agent will need 20 calls to answer a normal question, the
  answer is a `summarize` dimension, not better pagination advice.

### 7. Joins & cross-tool relationships

- For every ID field: take a value from tool A and use it in tool B. Does it resolve?
- **Coverage**: over a sample, what fraction of A-rows have a B-match? "Join key" with 30%
  coverage needs saying so.
- Directionality and keyspaces: two ID-shaped fields can look identical and index disjointly — a
  value that works as `supplierId` returns 0 as `manufacturerId`.
- Conditional joins: a link that only works for one record subtype, not another.
- Cross-server joins count too, if you have more than one MCP server. Verify them on real IDs
  before promoting them to a RELATED TOOLS line.

### 8. Temporal edges & sentinels

- Oldest and newest record — sort both ways. Is history truncated? Is there a migration cut-off
  where field population changes?
- Sentinel dates (`0001-01-01`, `1900-01-01`, `9999-12-31`) and sentinel numbers. Normalise them
  to null in `transform`, and say so in the field's `.meta()`.
- Soft-deleted / inactive rows: are they returned by default? Can you filter them out?
- Aggregation semantics: is a "meter reading" a period value (summable) or a running totalizer
  (summing it is 100× wrong)? Same unit, different meaning. Detect and route, never silently sum.

### 9. Failure surface

- Bad ID, wrong type, absurd page size, unknown field name, expired cursor. Record status codes
  and whether the body carries useful detail — error bodies often leak discovery info (valid
  values, available layouts).
- Which endpoints are simply broken? Note them and **do not expose them as tools** — document the
  working alternative path instead, if one exists.
- Latency and cold starts — they set the function timeout and the QUERY STRATEGY advice.

---

## Session prompts that work

Give one at a time, in a fresh context, and read the answer before choosing the next.

```
List every field returned by <tool>, its type, and null frequency over 200 rows.
Now split that null count by <categorical field>. Which fields flip between slices?

Enumerate the distinct values of <status field> with counts. Show me the rarest five,
and one full record for each.

Sort by <numeric field> descending and show the top 10. Now ascending. Anything absurd?
Skip the first 200 and show me what's underneath — is it the same shape?

Filter <field> = <value>. Compare recordCount to the unfiltered call. Did the filter do anything?
Try each operator on <field>. Which error, which are ignored, which work?

Take 20 <A> records, use their <id> in <tool B>. How many resolve? What do the misses share?

Paginate to the end with page size 100. Do the pages sum to the reported total?
Reuse a cursor after changing the filter. After changing the page size. After 60 seconds.

Find records where <field> is null but you'd expect a value. What do those records have in common?
```

## Flag — while you find it, not afterwards

Every answer gets written down as a finding **with its confidence marker attached, immediately**:

```
[CONFIDENCE: HIGH — 0/2,431 rows populated across 3 categories. TODO: DOMAIN EXPERT —
 is this field ever used, or is it reserved?]
```

**HIGH** — confirmed across many records and several slices · **MEDIUM** — observed, exceptions
plausible · **LOW** — inferred from limited data or possibly environment-specific.

Flagging after the fact does not work: by then the ambiguity has already been resolved with the
model's best guess, and the guess reads exactly like an observation. The marker is what keeps the
distinction visible.

A marker carries two things — what you saw, and the question a human needs to answer. If the
question could be settled by another probe, run the probe instead; only genuinely
business-knowledge questions go on the expert's list. Sample-size discipline sets the level: a claim
from <100 rows in one slice is LOW, whatever it looks like.

Markers go to the expert in one batch — see `validation.md` for the session protocol — and are
deleted from the tool as they're answered, so what remains inline is always the open edge.

---

## Fallback: raw HTTP probing

Reach for a small probe script when the tool surface can't get you there:

- auth mechanism unknown or the docs are wrong about it,
- endpoint shape unknown (what does the bulk endpoint even return?),
- you need to sweep dozens of parameter values fast,
- an endpoint you would never expose as a tool needs checking,
- reproducing a vendor bug for a support ticket.

Run it as a standalone script (`npx tsx scripts/probe-<name>.ts` or equivalent). Read any secret
from your secret manager via an env-var override — never paste a key into the script.

A probe script earns its keep by covering what the tool can't:

1. **Auth-variant sweep** — try each plausible header/flow and treat "any status that isn't
   401/403" as acceptance, not just 200.
2. **Reachability** per domain/endpoint with a tiny limit.
3. **Shape dump** — top-level keys, envelope keys, one full record printed raw.
4. **Blind parameter discovery** — push a list of candidate values and *read the error bodies*;
   a 400 often enumerates what's valid. Include one deliberate garbage value to force a verbose
   error.
5. **Status-code distribution** across the candidate set, so the pattern is visible at a glance.

Keep the script versioned alongside the rest of your code; it is the reproduction recipe when the
vendor ships a fix.

---

## The findings doc

`docs/<name>-api-findings.md` is where discovery lives that is too long, too provisional, or too
vendor-specific for a tool description. Descriptions carry what the agent needs at call time; the
findings doc carries the evidence, the open questions and the maintenance agenda.

A structure that works well in practice:

```markdown
# <Server> — API findings
<date, environment, who probed, how to reproduce>

## 1. Auth & transport          what works, what was tried and failed, why
## 2. Real catalog scope        counted numbers, and which reported numbers are lies
## 3. Pagination                cursor/offset semantics, scope- and size-binding, expiry
## 4. Filtering                 per-parameter semantics, ignored params, traps
## 5. Row shape                 populated vs sparse vs sentinel, per entity
## 6. Cross-server              which joins were tested, coverage, verdict per pair
## 7. Known bugs                endpoint + repro + status, to forward to the vendor
## 8. Re-check when API matures the maintenance agenda (bugs, dormant fields, enums)
## 9. Resolved gaps             what a domain expert or the vendor answered — and when
## 10. Decisions confirmed      closed questions, so nobody re-litigates them
```

Two habits that make it worth keeping: put the **reproduction command** next to every claim, and
date every section. A finding without a date is indistinguishable from a finding that has since
been fixed.

---

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Reading the first page and generalising | The top 10 rows are the newest or the oldest — never typical |
| "Examine the data" as a single instruction | Produces a report, not a discovery. Direct one probe at a time |
| Trusting a reported total | Cache artefacts and estimates are routine. Count it |
| Assuming a filter worked because it returned rows | Compare the count to unfiltered. Ignored params return everything |
| Discovering in the same chat that wrote the code | Stale tool catalog + confirmation bias |
| Writing "nullable" without the condition | The agent still doesn't know when to expect a value |
| Believing the vendor schema | Documented-but-never-returned fields are common |
| One pass and done | Pass 3–4 is where conditional population and business rules appear |

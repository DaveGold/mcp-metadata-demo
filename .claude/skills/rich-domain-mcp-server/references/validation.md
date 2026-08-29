# Validate & Iterate — closing the loop with humans and production

Examine and Flag produce observations. Observations are not knowledge until someone who knows the
business confirms them, and they stop being true the moment the source system changes. These two
steps are what keep the metadata honest.

Roughly **90% of AI-discovered metadata holds up under expert review**. The other 10% is exactly the
part that would otherwise ship as confident, plausible and wrong — and nobody would ever catch it,
because a wrong description produces a fluent answer, not an error.

---

# Validate — the expert session

## What the expert is for

Only questions the data cannot answer. Before a marker goes on the list, ask whether another probe
would settle it — if yes, probe instead. An expert's afternoon is the scarcest input in this whole
method; spend it on intent, history and business rules, never on facts you were too lazy to count.

| Ask the expert | Answer it yourself |
|---|---|
| Why is this field empty — legacy, process, or config? | How often is it empty, and for which record types |
| Is this status flow strictly sequential, or can steps be skipped? | Which status values exist and in what proportion |
| Is a value in this range legitimate, or a data-entry error? | What the range and outliers are |
| Does this code mean the same thing in every context it appears? | Which codes appear together |
| Should the agent surface this, or is it internal noise? | Whether the field is populated at all |

## Preparing the list

1. **Batch. Never drip-feed.** One list, one session. A question a week trains the expert to see you
   as an interruption; a prepared list of 20 gets 20 answers in an afternoon.
2. **LOW first, then MEDIUM.** LOW markers are the largest knowledge gaps — each one is a whole
   category of potential misinterpretation. HIGH markers are usually confirmations; put them at the
   end and skip them if time runs out.
3. **Group by business theme, not by tool.** An expert thinks in "the invoicing flow", not in
   `get_invoice_lines`. Grouping by tool makes them context-switch on every question.
4. **Closed questions, backed by evidence.** Every question carries the observation, the sample and
   the count. Compare:

   > ❌ "What does this field mean?"
   >
   > ✅ "29 of 31 records in category R have no fiscal-year value, while all category-G records do.
   > Is that a legacy-import artefact, or does the R flow genuinely not track a fiscal year?
   > **A / B / something else?**"

   The second gets an answer in fifteen seconds. The first gets a five-minute explanation of
   something you already knew.
5. **Say what you will do with the answer.** *"If it's a legacy artefact I'll tell the agent to
   ignore the missing value for category R; if it's real I'll make it a filter hint."* Experts
   calibrate their answer to the consequence.

## Running it

- **A sit-down beats async.** One afternoon in a room clears a backlog that would take three weeks
  of async messages. Follow-up questions are free in person and expensive in a thread.
- **Record answers verbatim first, interpret second.** "That's only for the old contracts" is more
  useful in the expert's words than in your paraphrase — you will re-read it in six months.
- **"I don't know" is a valid, valuable answer.** It means nobody knows, which is itself worth
  encoding: the field stays LOW and the description says the meaning is unconfirmed rather than
  inventing one.
- **A contradiction is a new finding, not a correction.** If the expert says a field is always
  populated and the data says it's 40% null, neither is lying — you have found config drift, an
  environment difference, or a process that changed without the data changing. Re-probe with that
  hypothesis before encoding anything.
- **Timebox per question.** Anything that takes more than a few minutes is a research task, not a
  validation question — park it back on the list as a new marker.

## After the session

For each answered marker:

1. **Encode** it (`metadata.md`) — description block, `.meta()`, `transform`, or an alert.
2. **Record** it in `docs/<name>-api-findings.md` under *Resolved gaps* / *Decisions confirmed*,
   **with a date and who answered**. This is what stops the same question being re-litigated next
   quarter.
3. **Delete the marker** from the tool. What remains inline is always the open edge — never the
   history of work done. (The history lives in the findings doc.)

An unanswered marker stays. A marker that survives two sessions is telling you the knowledge does
not exist in the organisation — say so in the description rather than leaving it open forever.

---

# Iterate — production telemetry as the next probe

After deploy, the input to the loop changes from your probes to real usage — assuming your handlers
log tool-call *shape* somewhere (no filter values, no response data, and a sensible retention
window).

## The three signals

**1. `queryIntent` read as a narrative.** This is the highest-value field in the log, and it only
works if you read consecutive calls as a story rather than as rows:

```
09:14:03  get_orders  summaryOnly=true, customerId=C-7056
          intent: "Overview of all orders for customer C-7056"
09:14:07  get_orders  status=Pending, customerId=C-7056
          intent: "Which orders are still pending for this customer"
09:14:09  get_orders  status=Pending, customerId=C-7056, unpaid=true
          intent: "Only unpaid ones — previous call also returned paid-but-pending items"
```

The third intent names the missing sentence exactly: the description never said that the status
filter alone returns paid items too. That is a one-line fix, permanently, in minutes. Without the
intents the same three rows are just "the agent added a filter" — unexplained.

**2. Call-shape patterns**, however you analyze your log (a saved query, a small script, a
dashboard if you have one):

| Signal | Likely metadata gap | Fix |
|---|---|---|
| Repeated calls with tightening filters | A filter's semantics aren't stated | QUERY STRATEGY / param `.meta()` |
| Deep pagination (`skip` climbing) | A `summary` dimension is missing | Add it to `summarize` — don't advise better paging |
| Tool never selected, though it fits | WHEN TO USE doesn't match how users phrase it | Rewrite WHEN TO USE; add WHEN NOT TO USE in the tool being picked instead |
| Two tools always called in sequence | An undocumented join | RELATED TOOLS + join key in the field `.meta()` |
| High `validation_warning` rate | The API changed shape under you | Check any stripped-fields log event |
| Many 0-row calls on valid input | Empty-result hint sends the agent down the wrong branch | Tool-specific `emptyResultHint` |

**3. User-reported friction** (a feedback tool, a support channel, anything) — the accelerator, not
the foundation. Agents/users report friction rarely and unreliably; treat every report as
high-signal precisely because it is rare. If your feedback mechanism captures a reasoning/context
field, that's the valuable one — it shows the reasoning path that led astray, which is what you are
actually fixing.

## The join key

If you have a session or call identifier available, it links a problem report to the complete
tool-call sequence that preceded it. You see not just what the agent got wrong, but how it tried to
get it right — which is the difference between a guess at a fix and a targeted one.

## Cadence

Weekly is enough, and it is a short read once the queries are saved. What you are looking for is not
errors — those should already be in your error logs and alerting. You are looking for **successful
calls that took three attempts**, because those are silent failures of the metadata, and they never
surface any other way.

## Feeding it back

Each fix re-enters the loop at Encode, and anything you can't explain from the log re-enters at
Examine with a specific hypothesis. Findings that need business context go back on the list for the
next Validate session. That is the whole loop running on production data instead of your probes —
and it is cheaper per improvement than any pass that came before it.

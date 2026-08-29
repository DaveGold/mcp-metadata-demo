# Handlers — the tool lifecycle contract

Every tool handler should implement the same six-step lifecycle, whether or not you have a shared
factory function for it. A shared factory is what makes permissions, alerts, output validation and
observability *hard to forget* on any one tool — but direct, hand-rolled logic is perfectly
acceptable for tools that don't fit the query→transform→summarize shape at all (games, MCP App
render tools), or for a codebase small enough that a shared factory would be premature. This same
repo's [get-building-profile.ts](../../../../src/tools/get-building-profile.ts) hand-rolls the
lifecycle directly (`resolveBuildingProfile` + `generateAlerts`, no shared factory) — that's a
legitimate, working example of the same steps, not a shortcut.

---

## The lifecycle

```
checkPermission (if you have an auth layer)
  → execute            tool-specific API call(s), returns TResult[]
  → transform?         derived fields, sentinel normalisation — mutates in place
  → summarize?         domain aggregation + interpretation.alerts
  → inject alerts      empty-result hint, feedback reminder (if you have one)
  → validate output    Zod safeParse against outputSchema
  → return             { structuredContent, content }
finally
  → log the call       wherever you keep tool-call history, if anywhere
```

## If you do build a shared factory

The shape stays the same regardless of transport:

| Your API | Write one factory shaped around… |
|---|---|
| REST / JSON | an `execute(client, args) => Promise<TResult[]>` function |
| A vendor-specific REST filter protocol | the same `execute` shape, plus a shared filter-building helper |
| GraphQL | a single query executor |
| SQL passthrough | a single query runner |
| Something else entirely | copy whichever of the above is closest, swap the `execute` contract |

Config shape:

```ts
export interface RestHandlerConfig<TClient, TResult> {
  toolName: string;                 // permissions + logging
  operationName: string;            // logging, e.g. 'GetAssets'
  execute: (client: TClient, args: Record<string, unknown>) => Promise<TResult[]>;
  transform?: (records: TResult[]) => void;
  summarize?: (records: TResult[], args: Record<string, unknown>) => SummaryResult;
  outputSchema?: Record<string, z.ZodTypeAny>;
  emptyResultHint?: string;         // per-tool — see below
}
```

Direct tool logic without a factory is acceptable only for tools that don't fit the
query→transform→summarize shape at all (games, MCP App tools). Those still owe you a permission
check (if applicable) and a log write.

## Non-negotiable invariants

1. **A permission check first, before any API call** — if your server has an auth layer at all.
2. **`interpretation.alerts` on every response**, even when empty.
3. **Empty-result hint** — tool-specific, and it must distinguish *"wrong lookup, try something
   else"* from *"valid query, genuinely nothing here"*. Pass a per-tool hint; never let a shared
   generic message name parameters your tool doesn't have.
4. **Feedback reminder as the last alert, if you have a feedback mechanism** — pointing at however
   your users/agents report friction. Skip this step entirely if you don't have one.
5. **Validate output before the SDK does.** On failure: log the issues, return `{ content, isError:
   true }` with the data as text and **no `structuredContent`**. Some SDKs throw when an
   `outputSchema` is registered but `structuredContent` is missing — `isError: true` skips that
   validation, so the agent still gets the data plus an explanation instead of a generic error.
6. **Return the validated data, not the raw output.** Zod (or your validator) strips unknown keys;
   if the JSON Schema is `additionalProperties: false`, returning the raw object breaks the
   contract.
7. **Log stripped fields**, if your validator supports reporting them. New vendor fields arriving
   in the API show up here first — it's a free change-detector.
8. **Log the call in a `finally`**, wrapped in its own try/catch so a logging failure never fails
   the tool call.
9. **Errors return `{ content, isError: true }`**, never a throw that escapes the handler.

## What's worth logging

Interaction *shape* only — never filter values, never response data, and set a sensible retention
window.

```
sessionId (if you have one) · environment · server · user · tool · queryIntent
filters (fields + operators, no values) · filterCount · summaryOnly · skip · take
status (success | error | validation_warning) · rowCount · hasMore · durationMs · errorType
```

If you have a session or call identifier available (from a JWT claim, a request header, whatever
your auth layer already carries), thread it through — it becomes the join key that links a
user-reported problem to the full call sequence that preceded it.

Whatever your structured-logging tool is, it's worth being able to query for at least: an output
validation error (with per-field issues), a stripped-fields event, and a protocol-level error.

## Nudges worth injecting

These are handler-injected, not left to the agent's judgement, if your handler supports it:

| Situation | Nudge |
|---|---|
| 0 records | The tool-specific empty-result hint |
| Deep pagination | *"If you're paginating to aggregate data the summary doesn't provide, that's a missing summary dimension — worth flagging."* |
| Capped summary | *"Summary is based on the first N records only — tighten your filters for a complete summary."* |
| Every response, if you have a feedback mechanism | *"If this query took multiple attempts, returned confusing data, or required workarounds, report it before your next step."* |

A pagination nudge that fires often is a missing `summary` dimension. Fix the metadata, not the
nudge.

## Permissions (if your server has an auth layer)

Restrict only genuinely sensitive tools with an explicit permission entry; leave everything else
open to any authenticated caller. A broader gate for the whole server (e.g. an allowlist while a new
server is still in the Scaffold/Examine stage) is a separate, temporary mechanism from per-tool
permission entries — don't conflate the two.

## `transform` vs `summarize`

- **`transform`** runs first, mutates rows in place. Use for per-row work: derived labels from flag
  combinations, sentinel → null normalisation, unit enrichment, parsing.
- **`summarize`** runs after, returns `{ summary, interpretation: { alerts } }`. Use for
  cross-record aggregation and for alerts that depend on the whole result set.

Two traps that cost real bugs in practice:

- **Fetch metadata that sample processing depends on.** If sum-vs-average depends on a `unit` the
  data response doesn't carry, fetch the units explicitly before bucketing. A silent fallback is
  worse than a hard error: nobody sees it, and the answer is off by a factor of the sample count.
- **Detect counters before bucketing.** A "kWh" variable may be period energy (summable) or a
  running totalizer (summing it is nonsense). Detect by name pattern, then skip with an alert or
  route to last-value/delta logic. Never silently sum.

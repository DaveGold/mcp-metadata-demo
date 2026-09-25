# MCP Apps: self-describing UI

The repo ships three MCP Apps: `render_chart` (14 chart types via Chart.js, with annotations),
`render_table` (TanStack Table with badge/icon/cell formatters) and `render_map` (Leaflet with
car/building/project/pin markers). It also ships `fetch_image`, a server-side image proxy with SSRF
protection that `render_table` uses when the iframe CSP blocks `img-src`. They apply the same
metadata strategy to UI configuration that the data tools apply to domain data. What their audit
found: [`app-tools-findings.md`](app-tools-findings.md).

## Two levels, one strategy

**Level 1: domain tool.** An agent calls `get_building_profile`, reads the `alerts[]` array, and
formulates a follow-up from the curated advisory text, no separate priming on Dutch energy
regulation:

```
> get_building_profile({ postcode: "1071XX", huisnummer: 1 })
  ... → alerts: ["Pre-Bouwbesluit 1992 — likely limited insulation.",
                  "No registered energy label found in EP-Online."]

> "Given the pre-1992 era and the lack of a registered label, what's the next step?"
```

**Level 2: self-describing app config.** The same agent then picks an appropriate visualisation.
The chart-type metadata tells it sankey is for flows, treemap for hierarchical area shares, bar for
category comparison, no wrapper logic
([see the `type` REFUSE rules](../src/tools/render-chart.ts#L162-L200)):

```
> Agent looks at three buildings' data and chooses render_chart({ type: 'bar', ... })
  because the schema's REFUSE rules say sankey requires flows (this data has none).
```

The two levels use the metadata layer differently, and the difference matters. `render_chart`'s
**input** schema is model-visible: the agent reads its REFUSE rules before generating a call,
which is why they work. `get_building_profile`'s **output** schema is _not_ model-visible: the
interpretation the agent uses at Level 1 comes from the tool description and the returned data,
never from the output schema itself.

Two things the evals added for app tools
([Q22](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)):
an example in an app's input schema is delivered, and is copied, including a Paris Proof line
drawn on calculated bars. And a fix the model _must_ make needs the call refused with the fix in
the message; an alert after a successful render is read as a note, not as a reason to redo it.

## Refuse what would mislead

In industrial control, a system that reports success while the operator cannot see the result is
badly designed; an interlock stops the action instead. The render tools apply that rule. A call
that would render nothing, or render something wrong, is refused with the fix in the message, not
drawn and reported as done:

- `render_chart` refuses a `type="line"` annotation without `scaleID` (Chart.js draws nothing and
  reports success), an annotation value that is not one of the category labels, and annotations on
  a chart type that cannot show them.
- `render_table` refuses rows whose shape does not match the columns, and (in `best`) a header
  that presents a calculated label figure as if it were measured consumption.
- `render_map` refuses an empty marker list and coordinates outside the valid range.

**Semantic correctness is part of UI correctness.** A chart can be syntactically valid and still
wrong: a Paris Proof line (defined on measured energy) drawn over calculated label figures looks
convincing and compares two different quantities. The evals found exactly that, copied from an
example in the input schema, and fixed it
([Q22](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).

**Refuse or alert.** Not every problem is a refusal. Where the render is usable but could be better
(a pie above five slices, too many line series, an overfull radar), `best` renders and returns an
alert with the fix. Where the fix is mandatory, it refuses: an alert after a successful render was
acted on 2/10, a refusal 10/10
([Q22b, Q22c](../.claude/skills/rich-domain-mcp-server/references/evidence.md#the-composite-reference-q19)).
The details: [`app-tools-findings.md`](app-tools-findings.md).

This is where the interaction design in the [capability architecture](capability-architecture.md#7--a-skill-is-a-journey)
meets the measurements: choosing the surface is part of the journey, and a surface that misleads
is a failed step, however cleanly it renders.

## How an MCP app gets to the client

**The protocol**: MCP Apps delivers UI as a `ui://` resource. The host client (Claude Desktop,
claude.ai) receives a complete HTML string and renders it in an iframe. The resource exposes
`_meta.ui` for declarations like the CSP allow-list (`resourceDomains`), which is how `render_map`
reaches `tile.openstreetmap.org` even though the host CSP blocks external resources by default.

**The constraint that drives the stack**: one HTML string means all JS and CSS must be inlined. No
`<script src>` to a CDN, no separate stylesheets, no runtime chunk loading.

**The stack**:

- **Vite** bundler with **`vite-plugin-singlefile`** inlines every asset into one `index.html`.
  Output is one file per app: `build/ui/chart.html`, `build/ui/table.html`, `build/ui/map.html`. The
  server reads that file at startup and registers it with `registerAppResource(...)`.
- **Angular** (via `@analogjs/vite-plugin-angular`) so the framework slots into the same Vite
  pipeline. The choice of Angular is incidental, not required: React, Svelte, or vanilla TS would
  work the same way; Angular fits because the table renderer (cell formatters with badges, icons,
  sparklines) benefits from a strongly-typed component model.
- **Per-app entries**: `ui/apps/{chart,table,map}/index.html` are discovered by
  `scripts/build-ui.js` and built independently. One broken app doesn't block the others; each gets
  only the libraries it needs (Chart.js for chart, Leaflet for map, TanStack Table for table)
  instead of every library in every bundle.

**The data bridge**: the tool handler returns `structuredContent` (the chart config, table rows,
map markers) alongside `_meta.ui.resourceUri` pointing at the HTML. The MCP Apps SDK exposes that
`structuredContent` to the iframe as `window.mcpAppData`. The Angular component reads it at
bootstrap and renders. No follow-up fetch from iframe to server, no runtime API: one tool response
is everything.

The result: `render_chart`'s **input** schema is what the agent reads to generate this payload:
schema-guided generation, model-visible. The Angular-plus-Vite-single-file part is just how the
generated UI configuration becomes pixels.

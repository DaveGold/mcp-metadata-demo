# Changelog — rich-domain-mcp-server

Semantic versions; each release is the git tag `skill-v<version>` in
[DaveGold/mcp-metadata-demo](https://github.com/DaveGold/mcp-metadata-demo). Vendor a tag, not
`main`. A **major** version changes the overlay contract (`overlays.json`); a **minor** adds or
sharpens rules; a **patch** fixes wording, links or tooling. Every change to the skill bumps
`metadata.version` in `SKILL.md` and adds an entry here (CI checks both).

## 1.2.0 — 2026-09-27

Delivery measured beyond Claude Code [HD].

- **Server instructions: ≤ 512 characters, and nothing load-bearing only there.** ChatGPT cuts
  them at 512; claude.ai chat and ChatGPT Work do not deliver them; Cowork delivers them whole;
  Codex prepends them to every tool description. The old budget (≤ 2,048) was Claude Code's.
- The 2,048-character description budget stays: it is the strictest cut measured. Cowork (web)
  cuts at 4,096; Codex CLI, ChatGPT and claude.ai chat deliver the whole description, often only
  after the model searches for the tool.
- **Budgets by target client:** one table with three columns (Claude only, ChatGPT / Codex only,
  all clients). For all clients: server instructions ≤ 512 with nothing required in them;
  description ≤ 2,048; input schema ≤ 5,000 per tool (Codex and ChatGPT Work drop every describe
  above that hard limit; nesting does not matter); output schema for validation only; the meaning
  of the record in the response. Detail that does not fit goes in a REQUIRED guidance tool, and the
  tool name and first sentence say what the user can do, because claude.ai, Cowork, Codex and
  ChatGPT Work defer tools until the model searches.
- Points to the new `mcp-compat-check` skill, which scores a server's `tools/list` against the
  table per client, statically.
- `best` follows it for the instructions (744 → 492 characters, every line also in a description
  head). Its `render_table` input schema (6,155 characters) is over the 5,000 limit: on Codex and
  ChatGPT Work it arrives without a single describe.

## 1.1.1 — 2026-09-25

Evidence only; no rule changed.

- [Q25] and [Q26b] hold on sonnet (Q27). The when-to-pick lines matter there too, most on a score
  that haiku read right without them.
- [Q26] confirmed at n=10 for the types that were reached (Q26c). The when-to-pick lines showed
  no side effect on other columns or on whether a table is drawn (Q26d).

## 1.1.0 — 2026-09-25

Rules for app (render) tools and their input schemas, each with its evidence row.

- **Size the input schema to what forming the call needs.** It is re-sent every turn for every
  tool. Trim words first; move the shapes only some calls need behind a REQUIRED guidance tool
  [Q25].
- **Guidance is its own tool, not a mode of the tool it guides** [Q25c].
- **When trimming an enum's describe, keep the line on when to pick each value**, keyed on what
  the data is [Q26b].
- **Walk a type with data built for it before cutting it or moving it behind guidance**: absence
  from the logs is not unreachability [Q26].
- Evidence rows Q25, Q25c, Q26 and Q26b; the delivery table's input-schema row gains the cost
  paragraph.

## 1.0.1 — 2026-09-24

- `check-overlays.mjs` also works through a symlinked path.
- Enum guidance keyed on what the data is, and every enum value reachable, as a rule [Q24].

## 1.0.0 — 2026-09-24

- First release as a vendorable package with local overlays at fixed points (overlay contract 1.0).

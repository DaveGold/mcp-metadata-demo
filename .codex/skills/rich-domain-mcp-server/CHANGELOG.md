# Changelog — rich-domain-mcp-server

Semantic versions; each release is the git tag `skill-v<version>` in
[DaveGold/mcp-metadata-demo](https://github.com/DaveGold/mcp-metadata-demo). Vendor a tag, not
`main`. A **major** version changes the overlay contract (`overlays.json`); a **minor** adds or
sharpens rules; a **patch** fixes wording, links or tooling. Every change to the skill bumps
`metadata.version` in `SKILL.md` and adds an entry here (CI checks both).

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

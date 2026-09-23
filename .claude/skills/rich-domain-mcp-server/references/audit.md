# Audit — bringing an EXISTING server or tool to the reference

Use this when the tool already exists and already has metadata. Rich-looking metadata is not
evidence that it works: in this repo the richest tool delivered 28% of its description, and one
of its computed alerts asserted a verdict the eval set had shown to be wrong. The audit finds
those defects first, then the EFVEI loop (SKILL.md) improves what is left.

Order matters. **Wrongness first, volume last** — "Volume does not hurt. Wrongness does." [BT].

Write every finding down as you go, in the places [`recording.md`](recording.md) names. The audit
output is a dated section in `docs/<name>-findings.md`, not a chat message.

---

## Step 1 — Inventory (measure, do not read)

For each tool, produce a table:

| measure | how |
|---|---|
| description length, and the char offset of every block and every load-bearing sentence | `description.length`, `description.indexOf('…')` in a scratch script or test |
| server-instructions length | same |
| what exists ONLY in the output schema (`.describe()` text with no counterpart in description or response) | diff the schema describe strings against the description |
| largest realistic response, serialized | call with the widest valid input, `JSON.stringify(result).length` |
| every field name in the response, with unit and provenance | from a real response, not the vendor schema |
| every alert and every threshold/benchmark constant in the code | grep the summarize/alert code |

Anything past char 2,048, anything only in the output schema, and anything inside a response over
~25k tokens is **not delivered** [Q7] [Q11] [Q9]. Mark it; you will move it in step 3.

## Step 2 — Name audit

The response's field names are the only semantics that reach the model on every host, in every
response, with no budget [delivery.md]. Go field by field:

- **Does the name imply a different quantity?** calculated ↔ measured, total ↔ per m², a scope
  (building vs unit vs thermal zone), gross ↔ net, weighted ↔ unweighted. A readable name that
  points the wrong way overrides the prose next to it [N2].
- **Does a numeric name carry its unit** (`_kwh_m2`, `_pct`, `_m2`) — or say it has none
  (`_eenheidloos`, `_unitless`)? A unitless name gets a unit invented for it [N5].
- **Is it a magnet?** A code whose letters resemble the answer to a common question (`f_ga` → gas,
  `ahe` → heat demand) will be used for it [N3] [N4].
- **Is it opaque?** A terse code with no delivered glossary is confidently misread, never treated
  as unknown [N3]. Either rename it or make sure the glossary is delivered [N6].

If the API is **not yours**, rename in the `transform` layer and keep a mapping table in source:
`{ upstream, name, reason, provenance }`. Rename only what the audit flags — keep established
domain/register terms (`bouwjaar`, `gebruiksdoel`) that users and experts search for, because
names also leak from the user's own words [N7]. Do not rename where evidence shows no confusion
[N8]; a rename is a change every consumer has to absorb.

## Step 3 — Delivery fix

- Move everything past char 2,048 either **forward** (if it must be known before a call) or into
  the **response** under `interpretation` (if it interprets returned values). Most of an
  INTERPRETATION block belongs in the response.
- Rewrite the description head so the budget buys the most decision-relevant sentences: what the
  tool is NOT (refusals), the input conventions, the three or four rules that hold for every
  record. See `metadata.md` §1.
- Move any model-facing meaning out of the output schema.
- If a response can exceed the limit, add a size guard that drops bulk rows with an alert naming
  the remedy.

## Step 4 — Wrongness audit

For every alert, threshold, benchmark and derived value:

1. **What are the two sides of the comparison, and what kind of quantity is each?** A calculated
   (modelled) figure compared with a target defined on measured data is the defect that produced
   59/60 wrong answers [BT]. Check the definition of the target, not its name.
2. **Is the constant sourced?** An unnamed "benchmark" is a guess shipped as a verdict.
3. **Is it determinate?** If the rule depends on judgment (a construction-era heuristic), it is
   not a computed verdict; turn it into a flagged note or remove it.
4. **Does the rule need data the payload lacks?** Then ship the data [Q16], not only the rule.
5. **Does it truncate?** "(+6 more)" hid the boundary cases a model then misread [Q11b]. Return
   thresholded results complete.
6. **What does it return on the empty branch?** A 0 that means "no data" presented as a number
   (a 0 °C mean over zero measured days) is a wrong value.

A computed value is the most readily believed thing a tool can emit (78/78 when right [L1]),
which is exactly why a wrong one is the worst failure in the set.

## Step 5 — Provenance backfill

Every rule, alert and rename gets a provenance line in source: the date, and the eval result,
incident, expert answer or observation behind it [Q18]. Where you have none, write
`[CONFIDENCE: LOW — <what you believe>. TODO: DOMAIN EXPERT — <question>]` instead. The next agent
that improves the server decides from this line whether a rule may go.

## Step 6 — Migrate and measure

Rebuild to the reference shape (SKILL.md → *Reference implementation*) as a NEW variant next to
the old one, not in place, so the old one stays measurable. Then measure the two against each
other ([`evaluation.md`](evaluation.md)). Keep the old variant's wire surface frozen with a hash
test until the new one has been measured.

---

## Audit checklist

- [ ] Inventory table per tool (offsets, lengths, schema-only text, max response size)
- [ ] Name audit: every misleading / unitless / magnet / opaque name listed with a decision
- [ ] Nothing load-bearing past char 2,048; instructions ≤ 2,048
- [ ] No model-facing meaning only in the output schema
- [ ] Every alert/threshold: quantity kinds on both sides, sourced constant, determinate, complete
- [ ] Every rule and rename has provenance or a confidence marker
- [ ] Findings dated in `docs/<name>-findings.md`
- [ ] New variant built beside the old one; old one hash-frozen; comparison registered

/**
 * Firebase Cloud Functions entry — hosted demo endpoint.
 *
 * Single function exposing the MCP server over Streamable HTTP at the
 * Cloud Run URL Firebase assigns. No auth: the endpoint is public so
 * anyone can paste the URL into their MCP client and try the demo.
 *
 * EP-Online API key flows in via Firebase secret `EP_ONLINE_API_KEY`,
 * which Cloud Functions exposes as process.env at runtime — same code
 * path as local `.env`.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { createHttpApp } from './http.js';

const functionOptions = {
  region: 'europe-west4',
  memory: '256MiB' as const,
  timeoutSeconds: 60,
  maxInstances: 3,
  secrets: ['EP_ONLINE_API_KEY'],
  invoker: 'public',
};

/** Rich tier — the full metadata strategy. */
export const mcp = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'rich' }));

/**
 * Minimal tier — the "missing layer" ablation. Same data, metadata stripped
 * (one-sentence description, no schema, no alerts). Deployed alongside `mcp`
 * so the two endpoints can be compared directly.
 */
export const mcpMinimal = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'minimal' }));

/**
 * Thin tier — the same `minimal` variant under the name the talk and the docs use for it.
 * `/mcpMinimal` stays: it is the URL on the MCPCon slide and in the eval arms' config.
 */
export const mcpThin = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'minimal' }));

/**
 * Schema tier — the rung between minimal and words. Minimal's one-sentence
 * description, but the full typed and `.describe()`d input/output schemas. It
 * exists so `minimal → schema → words` attributes the schema and the prose
 * separately; before it, the two moved together and neither could be measured.
 */
export const mcpSchema = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'schema' }));

/**
 * Inline tier — the CHANNEL arm. Description byte-identical to `mcpSchema`'s
 * one-liner; the INTERPRETATION prose is delivered in the tool RESPONSE instead.
 * `mcpSchema` → `mcpWords` and `mcpSchema` → `mcpInline` ship the same bytes by
 * two different routes, which is the only way to tell delivery from content.
 * See evals/open-questions.md, Q1.
 */
export const mcpInline = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'inline' }));

/**
 * Q1b RECIPE ARMS. Both ship the SAME imported `derivedFiguresBlock` — a
 * PROCEDURE, not a fact — by two different channels: `mcpWordsRecipe` appends it
 * to the description, `mcpInlineRecipe` appends it to the response prose. The
 * pair asks whether a procedure is executed at all when it arrives in a response,
 * given that in a description it was applied 0 of 13 times.
 * See evals/open-questions.md Q1b.
 */
export const mcpWordsRecipe = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'words-recipe' }));
export const mcpInlineRecipe = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'inline-recipe' }));

/**
 * Q2 arm — CONDITIONAL interpretation. As `mcpInline`, but the response carries
 * only the branch matching the record's berekeningstype plus the notes for fields
 * that are actually populated. A description cannot do this: it is written before
 * the data is known. See evals/open-questions.md, Q2.
 */
/**
 * Q14 arm — the MINIMUM VIABLE RESPONSE. `words`' description byte for byte, plus
 * ONE sliced INTERPRETATION line in the response. `mcpWords` → `mcpInlineOneline`
 * differs by exactly that line, which is the cheapest fix a production server
 * could ship. See open-questions.md Q14.
 */
export const mcpInlineOneline = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'inline-oneline' }));

export const mcpInlineConditional = onRequest(
  functionOptions,
  createHttpApp({ hosted: true, variant: 'inline-conditional' }),
);

/**
 * Q4 arms — the FACT / INSTRUCTION ablation of the CALCULATED vs MEASURED line.
 * `mcpInline` is the third arm (both halves) and needs no new function. See
 * evals/open-questions.md Q4.
 */
export const mcpInlineFact = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'inline-fact' }));
export const mcpInlineInstruction = onRequest(
  functionOptions,
  createHttpApp({ hosted: true, variant: 'inline-instruction' }),
);

/**
 * Words tier — arm B of the ablation. Identical prose and schemas to `mcp`, but
 * no computed alerts, so A→B measures what the words buy and B→C measures what
 * the capability adds.
 */
export const mcpWords = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'words' }));

/**
 * Opaque tiers — A' and B'. Same data, field names stripped to the terse codes a
 * legacy register would emit. `mcpOpaque` carries a one-sentence description;
 * `mcpOpaqueWords` adds the interpretation guidance keyed to those codes, and
 * differs in nothing else. The pair isolates what the guidance buys once the
 * self-describing field names are no longer doing the work for it.
 */
export const mcpOpaque = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'opaque' }));
export const mcpOpaqueWords = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'opaque-words' }));

/**
 * Q8 arm — the GUIDANCE-CALL channel. The DERIVED FIGURES recipe comes back from a
 * no-argument call, before any data exists; lookups carry no prose. The third
 * channel beside `mcpWordsRecipe` (description) and `mcpInlineRecipe` (response).
 * See open-questions.md Q8.
 */
export const mcpGuidanceRecipe = onRequest(
  functionOptions,
  createHttpApp({ hosted: true, variant: 'guidance-recipe' }),
);

/**
 * The `best` arm — the reference implementation built with the rich-domain-mcp-server
 * skill: renamed fields, ≤2,048-char descriptions, `interpretation`-first responses from a
 * rule registry, computed values, shipped reference data. Measured as open-questions.md Q19.
 */
export const mcpBest = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'best' }));

/** `best` before its app tools were rebuilt (Q22): frozen for comparison. */
export const mcpBestV1 = onRequest(functionOptions, createHttpApp({ hosted: true, variant: 'best-v1' }));

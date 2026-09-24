/**
 * The example code — the reference implementation and the shared code it runs on — explains the
 * domain, not the experiments. Eval history (Q numbers, model names, scores, arms) lives in
 * evals/ and docs/; the source may point there from a provenance line (`… · evals/results/x.json`).
 * The eval arms themselves (files marked EVAL ARM) and the rich tier's arm fragments are exempt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const EXAMPLE_CODE = [
  'src/tools/get-building-profile-best.ts',
  'src/tools/get-weather-context-best.ts',
  'src/tools/best-instructions.ts',
  'src/tools/app-tools-best.ts',
  'src/tools/render-chart-schema-best.ts',
  'src/tools/render-table-schema-best.ts',
  'src/tools/chart-guidance.ts',
  'src/domain/best-rules.ts',
  'src/domain/best-building-rules.ts',
  'src/domain/best-weather-rules.ts',
  'src/domain/best-field-names.ts',
  'src/domain/reference-period.ts',
  'src/domain/generate-alerts.ts',
  'src/domain/build-profile.ts',
  'src/domain/select-best-label.ts',
  'src/domain/project-fields.ts',
  'src/tools/get-weather-context.ts',
  'src/tools/render-chart.ts',
  'src/tools/render-table.ts',
  'src/tools/render-map.ts',
  'src/tools/fetch-image.ts',
  'src/shared/log-store.ts',
  'src/shared/log-context.ts',
];

const TRACES: [string, RegExp][] = [
  ['an eval question number', /\bQ\d{1,2}[a-d]?\b(?! \d{4})/],
  ['a model name', /\b(haiku|sonnet|opus)\b/i],
  ['an eval arm', /\b(arms?|best arm|rich arm)\b/i],
  ['a score', /\b\d+\/\d+ (runs|correct|answers)|\b\d+\/\d+ ?→ ?\d+\/\d+/],
  ['an eval-question id', /\b(benchmark-trap|absent-sizing|readable-ladder|heat-pump-triage)\b/],
];

describe('example code carries no eval traces', () => {
  it.each(EXAMPLE_CODE)('%s', (file) => {
    // A pointer to an evidence file is allowed; its file name is not prose.
    const lines = readFileSync(join(ROOT, file), 'utf8')
      .replace(/evals\/results\/[\w.-]+\.json/g, '<evidence>')
      .split('\n');
    const hits = lines.flatMap((line, i) =>
      TRACES.filter(([, re]) => re.test(line)).map(
        ([what]) => `${file}:${i + 1} ${what}: ${line.trim().slice(0, 100)}`,
      ),
    );
    expect(hits).toEqual([]);
  });
});

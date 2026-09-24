/** Regenerate docs/wire/<arm>.md from the live server factory. See src/wire-view.ts. */
import { writeFileSync } from 'node:fs';
import { WIRE_VIEW_ARMS, renderWireView } from '../src/wire-view.js';

for (const { arm, blurb } of WIRE_VIEW_ARMS) {
  writeFileSync(`docs/wire/${arm}.md`, await renderWireView(arm, blurb));
  console.log(`docs/wire/${arm}.md`);
}

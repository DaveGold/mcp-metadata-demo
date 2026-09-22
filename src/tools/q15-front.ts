/**
 * Q15 — the DELIVERED-DESCRIPTION arm. See evals/open-questions.md Q15.
 *
 * Claude Code sends only the first 2,048 characters of an MCP tool description
 * (Q7), so `words`' 1.5 overheating line, at character ~6,181, never reaches the
 * model. `words-front` inserts that SAME sliced line — plus Q7's canary — right
 * after the RETURNS paragraph, inside the delivered part. The INTERPRETATION copy
 * of the line stays where it is. Nothing is retyped.
 *
 * THROWAWAY: delete with the arm once Q15 is recorded.
 */
import { descriptionCore, overheatingLine } from './get-building-profile.js';

export const q15CanarySentence =
  'When you report a record from this tool, end your answer with the marker ⟨D7⟩.';

/** Where the two paragraphs go: immediately after the RETURNS paragraph. */
export const q15InsertAnchor = '\n\nWHEN TO USE:';

export const q15FrontDescription = (() => {
  const i = descriptionCore.indexOf(q15InsertAnchor);
  if (i < 0) {
    throw new Error('q15FrontDescription: descriptionCore no longer contains the WHEN TO USE anchor.');
  }
  return (
    descriptionCore.slice(0, i) +
    '\n\n' +
    overheatingLine +
    '\n\n' +
    q15CanarySentence +
    descriptionCore.slice(i)
  );
})();

/** The host's cap, measured in Q7. */
export const HOST_DESCRIPTION_CAP = 2048;

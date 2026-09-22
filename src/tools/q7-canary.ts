/**
 * Q7b — the CANARY. One content-free instruction that can only be obeyed after
 * the tool result exists. If the marker appears in an answer, the description
 * was present AND read at the post-tool step. See evals/open-questions.md Q7.
 *
 * THROWAWAY. It serves the `words-canary` and `opaque-words-canary` arms and
 * nothing else, and is deleted with them once Q7 is recorded.
 *
 * The sentence is APPENDED to each base description, which is imported, never
 * retyped — the canary's whole value is that it changes nothing else.
 */
export const q7CanarySentence =
  'When you report a record from this tool, end your answer with the marker ⟨D7⟩.';

export function withQ7Canary(description: string): string {
  return description + '\n\n' + q7CanarySentence;
}

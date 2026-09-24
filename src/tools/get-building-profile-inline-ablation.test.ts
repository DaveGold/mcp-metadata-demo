/**
 * Pins the Q4 ablation arms. The experiment is only valid if the three arms
 * differ in EXACTLY one line and nothing else, and if that line's two halves
 * reconstitute the deployed line byte for byte.
 */
import { describe, it, expect } from 'vitest';
import {
  interpretationBlock,
  calcVsMeasuredLine,
  calcVsMeasuredLabel,
  calcVsMeasuredFact,
  calcVsMeasuredInstruction,
  calcVsMeasuredFactOnly,
  calcVsMeasuredInstructionOnly,
} from './get-building-profile.js';
import { ablatedInterpretation } from './get-building-profile-inline-ablation.js';

const lines = (s: string) => s.split('\n');
const calcLine = (s: string) =>
  lines(s).find((l) => l.startsWith('- CALCULATED vs MEASURED') || l.includes('rather than producing a ratio'));

describe('Q4 ablation arms', () => {
  it('both = fact + instruction, byte for byte', () => {
    expect(calcVsMeasuredLine).toBe(calcVsMeasuredLabel + calcVsMeasuredFact + ' ' + calcVsMeasuredInstruction);
  });

  it('the deployed block carries the composed line verbatim', () => {
    expect(interpretationBlock).toContain(calcVsMeasuredLine);
  });

  it('each arm differs from inline in EXACTLY one line', () => {
    for (const mode of ['fact', 'instruction'] as const) {
      const armLines = lines(ablatedInterpretation(mode));
      const baseLines = lines(interpretationBlock);
      expect(armLines).toHaveLength(baseLines.length);
      const differing = armLines.filter((l, i) => l !== baseLines[i]);
      expect(differing).toHaveLength(1);
    }
  });

  it('fact-only keeps the semantics and drops the directive', () => {
    const t = ablatedInterpretation('fact');
    expect(t).toContain('MEASURED FINAL energy at the meter');
    expect(t).toContain('NO metered data');
    expect(t).not.toContain('rather than producing a ratio');
  });

  it('instruction-only keeps the directive, drops the semantics AND the label', () => {
    const t = ablatedInterpretation('instruction');
    expect(t).toContain('rather than producing a ratio');
    expect(t).not.toContain('MEASURED FINAL energy at the meter');
    expect(t).not.toContain('NO metered data');
    // The label is itself a statement of the distinction — it must not leak.
    expect(t).not.toContain('CALCULATED vs MEASURED');
  });

  it('the two arms are not equal to each other or to inline', () => {
    const f = ablatedInterpretation('fact');
    const i = ablatedInterpretation('instruction');
    expect(f).not.toBe(i);
    expect(f).not.toBe(interpretationBlock);
    expect(i).not.toBe(interpretationBlock);
  });

  it('both arms are strictly shorter than inline, and instruction-only is shortest', () => {
    const f = ablatedInterpretation('fact').length;
    const i = ablatedInterpretation('instruction').length;
    expect(f).toBeLessThan(interpretationBlock.length);
    expect(i).toBeLessThan(f);
  });

  it('every emitted line is sliced from the source block or is the declared replacement', () => {
    const allowed = new Set([...lines(interpretationBlock), calcVsMeasuredFactOnly, calcVsMeasuredInstructionOnly]);
    for (const mode of ['fact', 'instruction'] as const) {
      for (const line of lines(ablatedInterpretation(mode))) {
        expect(allowed.has(line)).toBe(true);
      }
    }
  });

  it('sanity: the replaced line is the one we think it is', () => {
    expect(calcLine(interpretationBlock)).toBe(calcVsMeasuredLine);
    expect(calcLine(ablatedInterpretation('fact'))).toBe(calcVsMeasuredFactOnly);
    expect(calcLine(ablatedInterpretation('instruction'))).toBe(calcVsMeasuredInstructionOnly);
  });
});

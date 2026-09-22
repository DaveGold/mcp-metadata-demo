/**
 * Q14's arm must differ from `words` in EXACTLY one thing: one line in the
 * response. These tests pin that, because an arm that quietly differs in two
 * ways measures nothing and the run that used it would look fine.
 */
import { describe, it, expect } from 'vitest';
import { createServer } from '../server.js';
import type { BagClientLike, EpOnlineClientLike } from './get-building-profile.js';
import {
  descriptionCore,
  interpretationBlock,
  overheatingLine,
  overheatingLabel,
} from './get-building-profile.js';

const stubBag = (): BagClientLike =>
  ({ searchAddresses: async () => [], getVerblijfsobject: async () => null, getPand: async () => null }) as unknown as BagClientLike;
const stubEp = (): EpOnlineClientLike =>
  ({ getLabelsForPand: async () => [] }) as unknown as EpOnlineClientLike;

const serverFor = (variant: 'inline-oneline' | 'words') =>
  createServer({ variant, bagClient: stubBag(), epOnlineClient: stubEp() });

function toolOf(server: unknown): { description?: string } {
  const registered = (server as { _registeredTools: Record<string, { description?: string }> })
    ._registeredTools;
  return registered['get_building_profile'];
}

describe('inline-oneline arm', () => {
  it('slices the overheating line out of interpretationBlock rather than retyping it', () => {
    expect(interpretationBlock).toContain(overheatingLine);
    expect(overheatingLine.startsWith(overheatingLabel)).toBe(true);
  });

  it('carries the thresholds the question turns on', () => {
    expect(overheatingLine).toContain('1.5');
    expect(overheatingLine).toContain('significant overheating');
  });

  it('is ONE line', () => {
    expect(overheatingLine.includes('\n')).toBe(false);
  });

  it('has a description byte-identical to the words tier — this is an ADDITION, not a move', () => {
    const oneline = toolOf(serverFor('inline-oneline'));
    const words = toolOf(serverFor('words'));
    expect(oneline.description).toBe(words.description);
    expect(oneline.description).toBe(descriptionCore);
  });

  it('keeps the threshold in the description too, so the only delta vs words is the response', () => {
    const oneline = toolOf(serverFor('inline-oneline'));
    expect(oneline.description).toContain(overheatingLine);
  });

  it('does NOT ship the whole block the way inline does', () => {
    expect(overheatingLine.length).toBeLessThan(interpretationBlock.length / 5);
  });
});

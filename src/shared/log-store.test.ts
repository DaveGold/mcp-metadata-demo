import { beforeEach, describe, expect, it } from 'vitest';
import { __resetRingBufferForTests, readRecentToolCalls, writeToolCallLog, type ToolCallLogEntry } from './log-store.js';

function entry(overrides: Partial<ToolCallLogEntry> = {}): ToolCallLogEntry {
  return {
    sessionId: 's1',
    environment: 'local',
    server: 'metadata-demo',
    user: 'unknown',
    userId: 'unknown',
    tool: 'get_building_profile',
    connector: 'GetBuildingProfile',
    queryIntent: 'test intent',
    filters: [],
    filterCount: 0,
    summaryOnly: false,
    skip: 0,
    take: 0,
    status: 'success',
    rowCount: 1,
    hasMore: false,
    durationMs: 12,
    errorType: null,
    ...overrides,
  };
}

describe('log-store (local / in-memory ring buffer path)', () => {
  beforeEach(() => {
    __resetRingBufferForTests();
  });

  it('reads back a written entry, most recent first', async () => {
    await writeToolCallLog(entry({ tool: 'get_building_profile', queryIntent: 'first' }));
    await writeToolCallLog(entry({ tool: 'render_chart', queryIntent: 'second' }));

    const records = await readRecentToolCalls('local', { limit: 10 });
    expect(records.map((r) => r.queryIntent)).toEqual(['second', 'first']);
  });

  it('filters by tool name', async () => {
    await writeToolCallLog(entry({ tool: 'get_building_profile', queryIntent: 'a' }));
    await writeToolCallLog(entry({ tool: 'render_chart', queryIntent: 'b' }));
    await writeToolCallLog(entry({ tool: 'get_building_profile', queryIntent: 'c' }));

    const records = await readRecentToolCalls('local', { tool: 'get_building_profile', limit: 10 });
    expect(records.map((r) => r.queryIntent)).toEqual(['c', 'a']);
  });

  it('respects the limit', async () => {
    for (let i = 0; i < 5; i++) {
      await writeToolCallLog(entry({ queryIntent: `call-${i}` }));
    }
    const records = await readRecentToolCalls('local', { limit: 2 });
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.queryIntent)).toEqual(['call-4', 'call-3']);
  });

  it('caps the ring buffer at 50 entries, dropping the oldest', async () => {
    for (let i = 0; i < 55; i++) {
      await writeToolCallLog(entry({ queryIntent: `call-${i}` }));
    }
    const records = await readRecentToolCalls('local', { limit: 100 });
    expect(records).toHaveLength(50);
    // Oldest 5 (call-0..call-4) were dropped; the buffer now holds call-5..call-54.
    expect(records[records.length - 1].queryIntent).toBe('call-5');
    expect(records[0].queryIntent).toBe('call-54');
  });

  it('returns an empty array when nothing has been logged', async () => {
    const records = await readRecentToolCalls('local', { limit: 10 });
    expect(records).toEqual([]);
  });
});

describe('log-store — the fields the eval audit depends on', () => {
  beforeEach(() => {
    __resetRingBufferForTests();
  });

  it('round-trips paramsPresent, rowCount and errorType', async () => {
    // paramsPresent is the highest-value field on the row: `wrong-unit` turns
    // entirely on whether huisletter was passed, and no answer text reveals it.
    await writeToolCallLog(
      entry({ queryIntent: 'with letter', paramsPresent: ['huisletter', 'queryIntent'], rowCount: 2 })
    );
    const [row] = await readRecentToolCalls('local', { limit: 10 });

    expect(row.paramsPresent).toEqual(['huisletter', 'queryIntent']);
    expect(row.rowCount).toBe(2);
    expect(row.errorType).toBeNull();
  });

  it('defaults paramsPresent to an empty array when the caller supplies none', async () => {
    // Six of the seven tools that write here never set it; they must not break.
    await writeToolCallLog(entry({ queryIntent: 'no optional params' }));
    const [row] = await readRecentToolCalls('local', { limit: 10 });

    expect(row.paramsPresent).toEqual([]);
  });

  it('stamps variant "unknown" when no request context is open', async () => {
    // stdio opens no context. Those rows must be identifiable so they are not
    // counted against an arm during an audit.
    await writeToolCallLog(entry({ queryIntent: 'stdio-ish' }));
    const [row] = await readRecentToolCalls('local', { limit: 10 });

    expect(row.variant).toBe('unknown');
  });

  it('filters by variant, which is the only way to attribute a row to an arm', async () => {
    const { requestContext } = await import('./log-context.js');

    await requestContext.run({ sessionId: 'a', environment: 'local', variant: 'words' }, async () => {
      await writeToolCallLog(entry({ queryIntent: 'words call' }));
    });
    await requestContext.run({ sessionId: 'b', environment: 'local', variant: 'inline' }, async () => {
      await writeToolCallLog(entry({ queryIntent: 'inline call one' }));
      await writeToolCallLog(entry({ queryIntent: 'inline call two' }));
    });

    const all = await readRecentToolCalls('local', { limit: 50 });
    expect(all).toHaveLength(3);

    const inlineOnly = await readRecentToolCalls('local', { limit: 50, variant: 'inline' });
    expect(inlineOnly).toHaveLength(2);
    expect(inlineOnly.every((r) => r.variant === 'inline')).toBe(true);

    const wordsOnly = await readRecentToolCalls('local', { limit: 50, variant: 'words' });
    expect(wordsOnly).toHaveLength(1);
    expect(wordsOnly[0].queryIntent).toBe('words call');
  });
});

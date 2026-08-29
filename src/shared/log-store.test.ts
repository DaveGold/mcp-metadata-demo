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

import { mergeActivities } from '../src/fit/merge';
import { FitParseResult, MergeOptions } from '../src/fit/types';

const BASE_TIME = new Date('2024-01-01T00:00:00Z');

function recordAt(seconds: number, extra: Record<string, any> = {}) {
  return {
    timestamp: new Date(BASE_TIME.getTime() + seconds * 1000),
    ...extra
  };
}

function buildParseResult(overrides: Partial<FitParseResult> = {}): FitParseResult {
  return {
    records: [],
    sessions: [{ total_moving_time: 10, timestamp: BASE_TIME, start_time: BASE_TIME }],
    laps: [{ total_moving_time: 5, timestamp: BASE_TIME, start_time: BASE_TIME }],
    events: [],
    file_ids: [{ manufacturer: 'garmin', product: 1, serial_number: 123 }],
    activity: { timestamp: BASE_TIME },
    ...overrides
  } as FitParseResult;
}

describe('mergeActivities', () => {
  const defaultOptions: MergeOptions = {
    toleranceSeconds: 1,
    replaceMovingTime: true,
    overlayFields: ['power', 'cadence']
  };

  it('merges power and cadence within tolerance', () => {
    const master = buildParseResult({
      records: [recordAt(0), recordAt(1), recordAt(2)]
    });
    const overlay = buildParseResult({
      records: [
        recordAt(-1, { power: 150, cadence: 80 }),
        recordAt(1, { power: 200, cadence: 85 }),
        recordAt(2, { power: 210 })
      ]
    });

    const { merged, stats } = mergeActivities(master, overlay, defaultOptions);

    expect(stats.matchedRecords).toBeGreaterThanOrEqual(2);
    expect(stats.powerUpdates).toBe(2);
    expect(stats.cadenceUpdates).toBe(1);
    expect(stats.fieldUpdates.power).toBe(2);
    expect(stats.fieldUpdates.cadence).toBe(1);
    expect(merged.records[0].power).toBe(200);
    expect(merged.records[0].cadence).toBe(85);
    expect(merged.records[1].power).toBe(210);
    expect(merged.records[1].cadence).toBeUndefined();
  });

  it('clips overlay records outside master time range', () => {
    const master = buildParseResult({
      records: [recordAt(0), recordAt(1), recordAt(2)]
    });
    const overlay = buildParseResult({
      records: [
        recordAt(-5, { power: 120 }),
        recordAt(0, { power: 130 }),
        recordAt(1, { power: 140 }),
        recordAt(10, { power: 200 })
      ]
    });

    const { stats, overlayMeta } = mergeActivities(master, overlay, defaultOptions);

    expect(overlayMeta.recordCount).toBe(4);
    expect(overlayMeta.clippedRecordCount).toBe(2);
    expect(stats.overlayRecordCount).toBe(4);
    expect(stats.clippedOverlayRecordCount).toBe(2);
  });

  it('replaces moving time fields when enabled', () => {
    const master = buildParseResult({
      sessions: [{ total_moving_time: 100, timestamp: BASE_TIME, start_time: BASE_TIME }],
      laps: [{ total_moving_time: 50, timestamp: BASE_TIME, start_time: BASE_TIME }],
      records: [recordAt(0), recordAt(1)]
    });
    const overlay = buildParseResult({
      sessions: [{ total_moving_time: 80, timestamp: BASE_TIME, start_time: BASE_TIME }],
      laps: [{ total_moving_time: 40, timestamp: BASE_TIME, start_time: BASE_TIME }],
      records: [recordAt(0), recordAt(1)]
    });

    const { merged } = mergeActivities(master, overlay, defaultOptions);

    expect(merged.sessions[0].total_moving_time).toBe(80);
    expect(merged.laps[0].total_moving_time).toBe(40);
  });

  it('does not update metrics when options disabled', () => {
    const master = buildParseResult({
      records: [recordAt(0), recordAt(1)]
    });
    const overlay = buildParseResult({
      records: [recordAt(0, { power: 250, cadence: 90 }), recordAt(1, { power: 260, cadence: 92 })]
    });

    const options: MergeOptions = {
      toleranceSeconds: 1,
      replaceMovingTime: false,
      overlayFields: []
    };

    const { merged, stats } = mergeActivities(master, overlay, options);

    expect(stats.powerUpdates).toBe(0);
    expect(stats.cadenceUpdates).toBe(0);
    expect(stats.fieldUpdates.power).toBeUndefined();
    expect(merged.records[0].power).toBeUndefined();
    expect(merged.records[0].cadence).toBeUndefined();
    expect(merged.sessions[0].total_moving_time).toBe(10);
  });

  it('filters master fields when selection provided', () => {
    const master = buildParseResult({
      records: [recordAt(0, { altitude: 10, heart_rate: 120, power: 150 })]
    });
    const overlay = buildParseResult({
      records: [recordAt(0, { power: 200, speed: 5 })]
    });

    const options: MergeOptions = {
      toleranceSeconds: 1,
      replaceMovingTime: false,
      overlayFields: ['power'],
      masterFields: ['timestamp', 'heart_rate']
    };

    const { merged } = mergeActivities(master, overlay, options);

    expect(Object.keys(merged.records[0])).toEqual(['timestamp', 'heart_rate', 'power']);
    expect(merged.records[0].heart_rate).toBe(120);
    expect(merged.records[0].power).toBe(200);
  });
});

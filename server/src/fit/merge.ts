import {
  ActivityMeta,
  BasicStats,
  FitLapMessage,
  FitParseResult,
  FitRecordMessage,
  FitSessionMessage,
  MergeDiffStats,
  MergeOptions
} from './types';
import { formatTimestamp, fromGarminTimestamp } from './time';

export interface MergedActivity {
  records: FitRecordMessage[];
  sessions: FitSessionMessage[];
  laps: FitLapMessage[];
  events: Array<Record<string, any>>;
  file_ids: Array<Record<string, any>>;
  activity?: Record<string, any>;
}

export interface MergeComputationResult {
  merged: MergedActivity;
  stats: MergeDiffStats;
  masterMeta: ActivityMeta;
  overlayMeta: ActivityMeta & { clippedRecordCount: number };
}

export function mergeActivities(
  master: FitParseResult,
  overlay: FitParseResult,
  options: MergeOptions
): MergeComputationResult {
  const masterRecords = cloneRecords(master.records);
  const overlayRecords = cloneRecords(overlay.records);

  const masterStart = getFirstTimestamp(masterRecords);
  const masterEnd = getLastTimestamp(masterRecords);

  if (!masterStart || !masterEnd) {
    throw new Error('Master FIT file is missing timestamped record data.');
  }

  const clippedOverlayRecords = clipRecords(overlayRecords, masterStart, masterEnd);

  const {
    mergedRecords,
    stats
  } = mergeRecordStreams(masterRecords, clippedOverlayRecords, options);

  const mergedSessions = cloneSessions(master.sessions);
  const mergedLaps = cloneLaps(master.laps);

  if (options.replaceMovingTime) {
    replaceMovingTime(mergedSessions, overlay.sessions);
    replaceMovingTime(mergedLaps, overlay.laps);
  }

  const merged: MergedActivity = {
    records: mergedRecords,
    sessions: mergedSessions,
    laps: mergedLaps,
    events: cloneArray(master.events || []),
    file_ids: cloneArray(master.file_ids || []),
    activity: master.activity ? { ...master.activity } : undefined
  };

  const masterMeta: ActivityMeta = {
    recordCount: masterRecords.length,
    startTimestamp: formatTimestamp(masterStart),
    endTimestamp: formatTimestamp(masterEnd)
  };

  const overlayStart = getFirstTimestamp(overlayRecords);
  const overlayEnd = getLastTimestamp(overlayRecords);

  const overlayMeta: ActivityMeta & { clippedRecordCount: number } = {
    recordCount: overlayRecords.length,
    clippedRecordCount: clippedOverlayRecords.length,
    startTimestamp: formatTimestamp(overlayStart),
    endTimestamp: formatTimestamp(overlayEnd)
  };

  const enhancedStats: MergeDiffStats = {
    ...stats,
    masterRecordCount: masterRecords.length,
    overlayRecordCount: overlayRecords.length,
    clippedOverlayRecordCount: clippedOverlayRecords.length
  };

  return {
    merged,
    stats: enhancedStats,
    masterMeta,
    overlayMeta
  };
}

function mergeRecordStreams(
  masterRecords: FitRecordMessage[],
  overlayRecords: FitRecordMessage[],
  options: MergeOptions
): { mergedRecords: FitRecordMessage[]; stats: MergeDiffStats } {
  const overlayFieldSet = new Set(
    (options.overlayFields || []).map((field) => field?.toString().trim()).filter(Boolean)
  );
  overlayFieldSet.delete('timestamp');

  const masterFieldSet =
    options.masterFields && options.masterFields.length
      ? new Set(
          [...options.masterFields, 'timestamp'].map((field) => field?.toString().trim()).filter(Boolean)
        )
      : null;

  const mergedRecords = masterRecords.map((record) => filterRecordFields(record, masterFieldSet));

  const toleranceMs = options.toleranceSeconds * 1000;
  let i = 0;
  let j = 0;
  let matchedRecords = 0;
  let powerUpdates = 0;
  let cadenceUpdates = 0;
  const powerValues: number[] = [];
  const cadenceValues: number[] = [];
  const fieldUpdates: Record<string, number> = {};

  while (i < mergedRecords.length && j < overlayRecords.length) {
    const masterRecord = mergedRecords[i];
    const overlayRecord = overlayRecords[j];

    const masterTimestamp = getTimestampMillis(masterRecord.timestamp);
    const overlayTimestamp = getTimestampMillis(overlayRecord.timestamp);

    if (masterTimestamp === undefined) {
      i++;
      continue;
    }
    if (overlayTimestamp === undefined) {
      j++;
      continue;
    }

    const delta = overlayTimestamp - masterTimestamp;

    if (Math.abs(delta) <= toleranceMs) {
      matchedRecords++;

      overlayFieldSet.forEach((field) => {
        if (field === 'timestamp') {
          return;
        }
        const value = (overlayRecord as Record<string, any>)[field];
        if (value === undefined || value === null) {
          return;
        }

        (masterRecord as Record<string, any>)[field] = value;
        fieldUpdates[field] = (fieldUpdates[field] || 0) + 1;

        if (field === 'power') {
          powerUpdates++;
          powerValues.push(value);
        }
        if (field === 'cadence') {
          cadenceUpdates++;
          cadenceValues.push(value);
        }
      });

      i++;
      j++;
    } else if (delta < 0) {
      j++;
    } else {
      i++;
    }
  }

  const stats: MergeDiffStats = {
    matchedRecords,
    powerUpdates,
    cadenceUpdates,
    masterRecordCount: mergedRecords.length,
    overlayRecordCount: overlayRecords.length,
    clippedOverlayRecordCount: overlayRecords.length,
    powerStats: computeStats(powerValues),
    cadenceStats: computeStats(cadenceValues),
    fieldUpdates
  };

  return { mergedRecords, stats };
}

function filterRecordFields(
  record: FitRecordMessage,
  allowedFields: Set<string> | null
): FitRecordMessage {
  const normalizedRecord = { ...record, timestamp: fromGarminTimestamp(record.timestamp) };

  if (!allowedFields || !allowedFields.size) {
    return normalizedRecord;
  }

  const filtered: FitRecordMessage = {};
  allowedFields.forEach((field) => {
    const value = (normalizedRecord as Record<string, any>)[field];
    if (value !== undefined) {
      (filtered as Record<string, any>)[field] = value;
    }
  });

  if (!('timestamp' in filtered) && normalizedRecord.timestamp) {
    (filtered as Record<string, any>).timestamp = normalizedRecord.timestamp;
  }

  return filtered;
}

function computeStats(values: number[]): BasicStats | undefined {
  if (!values.length) {
    return undefined;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((acc, value) => acc + value, 0);
  const avg = sum / values.length;

  return { min, max, avg: Number(avg.toFixed(2)) };
}

function clipRecords(
  records: FitRecordMessage[],
  start: Date,
  end: Date
): FitRecordMessage[] {
  const startMs = start.getTime();
  const endMs = end.getTime();

  return records.filter((record) => {
    const timestamp = getTimestampMillis(record.timestamp);
    if (timestamp === undefined) {
      return false;
    }
    return timestamp >= startMs && timestamp <= endMs;
  });
}

function replaceMovingTime<T extends { total_moving_time?: number }>(
  targets: T[],
  sources: T[] | undefined
) {
  if (!sources || !sources.length) {
    return;
  }

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const source = sources[index];
    if (!target || !source || source.total_moving_time == null) {
      continue;
    }
    target.total_moving_time = source.total_moving_time;
  }
}

function cloneRecords(records: FitRecordMessage[]): FitRecordMessage[] {
  return records.map((record) => ({ ...record, timestamp: fromGarminTimestamp(record.timestamp) }));
}

function cloneSessions(sessions: FitSessionMessage[]): FitSessionMessage[] {
  return sessions.map((session) => ({ ...session }));
}

function cloneLaps(laps: FitLapMessage[]): FitLapMessage[] {
  return laps.map((lap) => ({ ...lap }));
}

function cloneArray<T>(input: T[]): T[] {
  return input.map((item) => (typeof item === 'object' && item !== null ? { ...item } : item));
}

function getFirstTimestamp(records: FitRecordMessage[]): Date | undefined {
  for (const record of records) {
    const timestamp = fromGarminTimestamp(record.timestamp);
    if (timestamp) {
      return timestamp;
    }
  }
  return undefined;
}

function getLastTimestamp(records: FitRecordMessage[]): Date | undefined {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const timestamp = fromGarminTimestamp(records[index]?.timestamp);
    if (timestamp) {
      return timestamp;
    }
  }
  return undefined;
}

function getTimestampMillis(timestamp: Date | number | undefined): number | undefined {
  if (!timestamp) {
    return undefined;
  }

  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  const parsed = fromGarminTimestamp(timestamp);
  return parsed?.getTime();
}

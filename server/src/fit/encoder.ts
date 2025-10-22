import { FitWriter } from '@markw65/fit-file-writer';
import { fromGarminTimestamp } from './time';
import { MergedActivity } from './merge';

export function encodeMergedActivity(activity: MergedActivity): Buffer {
  if (!activity.file_ids.length) {
    throw new Error('Master FIT file is missing file_id message.');
  }
  if (!activity.sessions.length) {
    throw new Error('Master FIT file is missing session message.');
  }
  if (!activity.records.length) {
    throw new Error('Master FIT file is missing record messages.');
  }

  const writer = new FitWriter();

  const events = activity.events.length ? activity.events : buildDefaultEvents(activity.records);

  const write = (messageKind: string, source: Record<string, any>, lastUse = false) => {
    const fields = normalizeFields(source, writer);
    if (!Object.keys(fields).length) {
      return;
    }
    writer.writeMessage(messageKind, fields, null, lastUse);
  };

  activity.file_ids.forEach((message, index) => {
    write('file_id', message, index === activity.file_ids.length - 1);
  });

  events.forEach((message, index) => {
    write('event', message, index === events.length - 1 && !activity.records.length);
  });

  activity.records.forEach((record, index) => {
    write('record', record, index === activity.records.length - 1);
  });

  activity.laps.forEach((lap, index) => {
    write('lap', lap, index === activity.laps.length - 1);
  });

  activity.sessions.forEach((session, index) => {
    write('session', session, index === activity.sessions.length - 1 && !activity.activity);
  });

  if (activity.activity) {
    write('activity', activity.activity, true);
  }

  const dataView = writer.finish();
  return Buffer.from(dataView.buffer, dataView.byteOffset, dataView.byteLength);
}

function normalizeFields(source: Record<string, any>, writer: FitWriter): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (value instanceof Date) {
      normalized[key] = writer.time(value);
      continue;
    }

    if (Array.isArray(value)) {
      normalized[key] = value.map((entry) => (entry instanceof Date ? writer.time(entry) : entry));
      continue;
    }

    if (typeof value === 'object') {
      normalized[key] = value;
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

function buildDefaultEvents(records: Array<Record<string, any>>): Array<Record<string, any>> {
  if (!records.length) {
    return [];
  }

  const firstTimestamp = extractTimestamp(records[0]);
  const lastTimestamp = extractTimestamp(records[records.length - 1]);

  if (!firstTimestamp || !lastTimestamp) {
    return [];
  }

  return [
    {
      timestamp: firstTimestamp,
      event: 'timer',
      event_type: 'start'
    },
    {
      timestamp: lastTimestamp,
      event: 'timer',
      event_type: 'stop_all'
    }
  ];
}

function extractTimestamp(record: Record<string, any>): Date | undefined {
  if (!record) {
    return undefined;
  }
  return fromGarminTimestamp(record.timestamp);
}

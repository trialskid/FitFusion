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
    const fields = filterKnownFields(messageKind, normalizeFields(messageKind, source, writer));
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

function normalizeFields(
  messageKind: string,
  source: Record<string, any>,
  writer: FitWriter
): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (value instanceof Date) {
      normalized[key] = writer.time(value);
      continue;
    }

    if (isLatLongField(messageKind, key) && typeof value === 'number') {
      normalized[key] = writer.latlng((value * Math.PI) / 180);
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

function filterKnownFields(messageKind: string, fields: Record<string, any>): Record<string, any> {
  const allowed = ALLOWED_FIELDS[messageKind];
  if (!allowed) {
    return fields;
  }

  const filtered: Record<string, any> = {};
  const allowedSet = new Set(allowed);
  for (const [key, value] of Object.entries(fields)) {
    if (allowedSet.has(key)) {
      filtered[key] = value;
    }
  }

  return filtered;
}

function isLatLongField(messageKind: string, key: string): boolean {
  if (!LAT_LNG_FIELDS.has(key)) {
    return false;
  }

  if (messageKind === 'record' || messageKind === 'lap' || messageKind === 'session') {
    return true;
  }

  if (messageKind === 'activity' || messageKind === 'event') {
    return key === 'nec_lat' || key === 'nec_long' || key === 'swc_lat' || key === 'swc_long';
  }

  return false;
}

const LAT_LNG_FIELDS = new Set([
  'position_lat',
  'position_long',
  'start_position_lat',
  'start_position_long',
  'end_position_lat',
  'end_position_long',
  'nec_lat',
  'nec_long',
  'swc_lat',
  'swc_long'
]);

const ALLOWED_FIELDS: Record<string, readonly string[]> = {
  record: [
    'timestamp',
    'position_lat',
    'position_long',
    'gps_accuracy',
    'altitude',
    'distance',
    'heart_rate',
    'enhanced_speed',
    'speed',
    'cadence',
    'power',
    'temperature',
    'vertical_speed'
  ],
  event: ['timestamp', 'event', 'event_type', 'event_group', 'data', 'data16', 'data32', 'timer_trigger'],
  lap: [
    'timestamp',
    'event',
    'event_type',
    'start_time',
    'lap_trigger',
    'total_elapsed_time',
    'total_timer_time',
    'total_moving_time',
    'total_distance',
    'total_calories',
    'avg_speed',
    'max_speed',
    'avg_heart_rate',
    'max_heart_rate',
    'min_heart_rate',
    'avg_power',
    'max_power',
    'sport',
    'sub_sport',
    'message_index'
  ],
  session: [
    'timestamp',
    'start_time',
    'total_distance',
    'total_timer_time',
    'total_elapsed_time',
    'total_moving_time',
    'total_calories',
    'total_work',
    'avg_speed',
    'max_speed',
    'avg_heart_rate',
    'max_heart_rate',
    'min_heart_rate',
    'avg_power',
    'max_power',
    'normalized_power',
    'avg_altitude',
    'max_altitude',
    'min_altitude',
    'total_ascent',
    'total_descent',
    'avg_temperature',
    'first_lap_index',
    'num_laps',
    'sport',
    'sub_sport',
    'event',
    'event_type',
    'trigger',
    'nec_lat',
    'nec_long',
    'swc_lat',
    'swc_long',
    'message_index'
  ],
  activity: [
    'timestamp',
    'local_timestamp',
    'num_sessions',
    'type',
    'event',
    'event_type',
    'total_timer_time',
    'total_distance',
    'total_calories',
    'total_ascent',
    'total_descent'
  ],
  file_id: [
    'type',
    'manufacturer',
    'product',
    'serial_number',
    'time_created',
    'garmin_product',
    'product_name'
  ]
};

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

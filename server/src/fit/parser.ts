import FitParser from 'fit-file-parser';
import { FitLapMessage, FitParseResult, FitRecordMessage, FitSessionMessage } from './types';
import { fromGarminTimestamp } from './time';

export async function parseFitBuffer(buffer: Buffer): Promise<FitParseResult> {
  const parserInstance = new FitParser({
    force: true,
    mode: 'list',
    elapsedRecordField: false
  });

  return new Promise((resolve, reject) => {
    parserInstance.parse(buffer, (error, data) => {
      if (error) {
        reject(new Error(typeof error === 'string' ? error : 'Failed to parse FIT file'));
        return;
      }

      resolve(normalizeParseResult(data as Partial<FitParseResult>));
    });
  });
}

function normalizeParseResult(result: Partial<FitParseResult>): FitParseResult {
  const records = (result.records || []).map(cloneRecord);
  const sessions = (result.sessions || []).map(cloneSession);
  const laps = (result.laps || []).map(cloneLap);

  return {
    ...result,
    records,
    sessions,
    laps,
    events: (result.events || []).map(cloneGeneric),
    activity: result.activity ? cloneGeneric(result.activity) : undefined,
    file_ids: (result.file_ids || []).map(cloneGeneric)
  };
}

function cloneGeneric<T extends Record<string, any>>(item: T): T {
  return { ...item };
}

function cloneRecord(record: FitRecordMessage): FitRecordMessage {
  const cloned = { ...record } as FitRecordMessage;
  cloned.timestamp = fromGarminTimestamp(record.timestamp);
  return cloned;
}

function cloneSession(session: FitSessionMessage): FitSessionMessage {
  const cloned = { ...session } as FitSessionMessage;
  if (session.start_time) {
    cloned.start_time = fromGarminTimestamp(session.start_time) ?? session.start_time;
  }
  if (session.timestamp) {
    cloned.timestamp = fromGarminTimestamp(session.timestamp) ?? session.timestamp;
  }
  return cloned;
}

function cloneLap(lap: FitLapMessage): FitLapMessage {
  const cloned = { ...lap } as FitLapMessage;
  if (lap.start_time) {
    cloned.start_time = fromGarminTimestamp(lap.start_time) ?? lap.start_time;
  }
  if (lap.timestamp) {
    cloned.timestamp = fromGarminTimestamp(lap.timestamp) ?? lap.timestamp;
  }
  return cloned;
}

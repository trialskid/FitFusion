export const GARMIN_EPOCH = new Date('1989-12-31T00:00:00Z');

export interface FitFieldMap {
  [key: string]: any;
}

export interface FitRecordMessage extends FitFieldMap {
  timestamp?: Date;
  power?: number;
  cadence?: number;
}

export interface FitSessionMessage extends FitFieldMap {
  total_moving_time?: number;
}

export interface FitLapMessage extends FitFieldMap {
  total_moving_time?: number;
}

export interface FitParseResult {
  records: FitRecordMessage[];
  sessions: FitSessionMessage[];
  laps: FitLapMessage[];
  events: FitFieldMap[];
  activity?: FitFieldMap;
  file_ids: FitFieldMap[];
  [key: string]: any;
}

export interface MergeOptions {
  toleranceSeconds: number;
  replaceMovingTime: boolean;
  overlayFields: string[];
  masterFields?: string[];
}

export interface MergeDiffStats {
  matchedRecords: number;
  powerUpdates: number;
  cadenceUpdates: number;
  masterRecordCount: number;
  overlayRecordCount: number;
  clippedOverlayRecordCount: number;
  powerStats?: BasicStats;
  cadenceStats?: BasicStats;
  fieldUpdates: Record<string, number>;
}

export interface BasicStats {
  min: number;
  max: number;
  avg: number;
}

export interface ActivityMeta {
  recordCount: number;
  startTimestamp?: string;
  endTimestamp?: string;
}

export interface MergeReport {
  master: ActivityMeta;
  overlay: ActivityMeta & { clippedRecordCount: number };
  options: MergeOptions;
  updates: MergeDiffStats;
  availableFields: AvailableFieldSummary;
}

export interface MergeResult {
  buffer: Buffer;
  report: MergeReport;
}

export interface AvailableFieldSummary {
  master: string[];
  overlay: string[];
}

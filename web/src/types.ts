export interface MergeOptions {
  toleranceSeconds: number;
  replaceMovingTime: boolean;
  overlayFields: string[];
  masterFields?: string[];
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

export interface OverlayMeta extends ActivityMeta {
  clippedRecordCount: number;
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

export interface MergeReport {
  master: ActivityMeta;
  overlay: OverlayMeta;
  options: MergeOptions;
  updates: MergeDiffStats;
  availableFields: AvailableFields;
}

export interface AvailableFields {
  master: string[];
  overlay: string[];
}

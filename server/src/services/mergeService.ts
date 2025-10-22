import { encodeMergedActivity } from '../fit/encoder';
import { mergeActivities } from '../fit/merge';
import { parseFitBuffer } from '../fit/parser';
import {
  AvailableFieldSummary,
  MergeOptions,
  MergeResult,
  MergeReport
} from '../fit/types';

export async function previewFitMerge(
  masterBuffer: Buffer,
  overlayBuffer: Buffer,
  options: MergeOptions
): Promise<MergeReport> {
  const { master, overlay } = await parseInputs(masterBuffer, overlayBuffer);
  const availableFields = summarizeFields(master.records, overlay.records);
  const normalizedOptions = normalizeOptions(options, availableFields);
  const { stats, masterMeta, overlayMeta } = mergeActivities(master, overlay, normalizedOptions);
  return {
    master: masterMeta,
    overlay: overlayMeta,
    options: normalizedOptions,
    updates: stats,
    availableFields
  };
}

export async function mergeFitFiles(
  masterBuffer: Buffer,
  overlayBuffer: Buffer,
  options: MergeOptions
): Promise<MergeResult> {
  const { master, overlay } = await parseInputs(masterBuffer, overlayBuffer);
  const availableFields = summarizeFields(master.records, overlay.records);
  const normalizedOptions = normalizeOptions(options, availableFields);

  const { merged, stats, masterMeta, overlayMeta } = mergeActivities(
    master,
    overlay,
    normalizedOptions
  );

  const buffer = encodeMergedActivity(merged);

  const report: MergeReport = {
    master: masterMeta,
    overlay: overlayMeta,
    options: normalizedOptions,
    updates: stats,
    availableFields
  };

  return { buffer, report };
}

async function parseInputs(masterBuffer: Buffer, overlayBuffer: Buffer) {
  const [master, overlay] = await Promise.all([
    parseFitBuffer(masterBuffer),
    parseFitBuffer(overlayBuffer)
  ]);

  return { master, overlay };
}

function summarizeFields(masterRecords: Array<Record<string, any>>, overlayRecords: Array<Record<string, any>>): AvailableFieldSummary {
  return {
    master: extractFieldNames(masterRecords),
    overlay: extractFieldNames(overlayRecords)
  };
}

function extractFieldNames(records: Array<Record<string, any>>): string[] {
  const fields = new Set<string>();
  records.forEach((record) => {
    if (!record) {
      return;
    }
    Object.keys(record).forEach((key) => {
      if (key) {
        fields.add(key);
      }
    });
  });
  return Array.from(fields).sort();
}

function normalizeOptions(options: MergeOptions, availableFields: AvailableFieldSummary): MergeOptions {
  const overlayCandidates = normalizeFieldArray(options.overlayFields);
  const masterCandidates = normalizeFieldArray(options.masterFields);

  const overlayFields = overlayCandidates.filter((field) => availableFields.overlay.includes(field));

  let normalizedOverlayFields = overlayFields;
  if (!overlayFields.length) {
    const defaults = ['power', 'cadence'].filter((field) =>
      availableFields.overlay.includes(field)
    );
    normalizedOverlayFields = defaults.length ? defaults : overlayFields;
  }

  let masterFields: string[] | undefined;
  if (options.masterFields && options.masterFields.length) {
    const filtered = masterCandidates.filter((field) => availableFields.master.includes(field));
    if (!filtered.includes('timestamp') && availableFields.master.includes('timestamp')) {
      filtered.push('timestamp');
    }
    masterFields = filtered.length ? Array.from(new Set(filtered)) : ['timestamp'];
  } else {
    masterFields = undefined;
  }

  return {
    toleranceSeconds: options.toleranceSeconds,
    replaceMovingTime: options.replaceMovingTime,
    overlayFields: normalizedOverlayFields,
    masterFields
  };
}

function normalizeFieldArray(value: string[] | undefined): string[] {
  if (!value || !value.length) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0)
    )
  );
}

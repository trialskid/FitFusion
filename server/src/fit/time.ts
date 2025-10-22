import { GARMIN_EPOCH } from './types';

const GARMIN_EPOCH_MS = GARMIN_EPOCH.getTime();

export function toGarminTimestamp(value: Date | number | undefined | null): number | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Math.round((value.getTime() - GARMIN_EPOCH_MS) / 1000);
  }

  return value;
}

export function fromGarminTimestamp(value: number | Date | undefined | null): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value * 1000 + GARMIN_EPOCH_MS);
}

export function formatTimestamp(value: Date | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.toISOString();
}

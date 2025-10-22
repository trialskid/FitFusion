import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { mergeFitFiles, previewFitMerge } from '../services/mergeService';
import { MergeOptions } from '../fit/types';

const upload = multer({
  limits: {
    fileSize: 30 * 1024 * 1024
  }
});

const router = Router();

const uploadFields = upload.fields([
  { name: 'master', maxCount: 1 },
  { name: 'overlay', maxCount: 1 }
]);

router.post('/inspect', uploadFields, async (req, res, next) => {
  try {
    const payload = extractPayload(req, res);
    if (!payload) {
      return;
    }

    const report = await previewFitMerge(
      payload.masterFile.buffer,
      payload.overlayFile.buffer,
      payload.options
    );

    res.json(report);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/merge',
  uploadFields,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = extractPayload(req, res);
      if (!payload) {
        return;
      }

      const { buffer, report } = await mergeFitFiles(
        payload.masterFile.buffer,
        payload.overlayFile.buffer,
        payload.options
      );

      const encodedReport = Buffer.from(JSON.stringify(report)).toString('base64');

      res.setHeader('Content-Disposition', 'attachment; filename="merged.fit"');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', buffer.length.toString());
      res.setHeader('X-Merge-Report', encodedReport);

      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
);

function extractPayload(req: Request, res: Response):
  | { masterFile: Express.Multer.File; overlayFile: Express.Multer.File; options: MergeOptions }
  | null {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const masterFile = files?.master?.[0];
  const overlayFile = files?.overlay?.[0];

  if (!masterFile || !overlayFile) {
    res.status(400).json({ message: 'Both master and overlay FIT files are required.' });
    return null;
  }

  if (!isFitFile(masterFile.originalname) || !isFitFile(overlayFile.originalname)) {
    res.status(400).json({ message: 'Uploaded files must have a .fit extension.' });
    return null;
  }

  const options = parseOptions(req.body || {});
  return { masterFile, overlayFile, options };
}

function isFitFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.fit');
}

function parseOptions(body: Record<string, any>): MergeOptions {
  const overlayFields = parseFieldList(body?.overlayFields);
  const masterFields = parseFieldList(body?.masterFields);
  const fallbackOverlay: string[] = [];

  if (!overlayFields.length) {
    if (parseBoolean(body?.pullPower, true)) {
      fallbackOverlay.push('power');
    }
    if (parseBoolean(body?.pullCadence, true)) {
      fallbackOverlay.push('cadence');
    }
  }

  return {
    toleranceSeconds: parseTolerance(body?.toleranceSeconds),
    replaceMovingTime: parseBoolean(body?.replaceMovingTime, true),
    overlayFields: overlayFields.length ? overlayFields : fallbackOverlay,
    masterFields: masterFields.length ? masterFields : undefined
  };
}

function parseTolerance(value: unknown): number {
  const fallback = 1;
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.floor(parsed);
  }

  return fallback;
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parseFieldList(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseFieldList(entry));
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return [];
  }

  if (normalized.startsWith('[') || normalized.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) {
        return parseFieldList(parsed);
      }
    } catch {
      // fall back to comma parsing
    }
  }

  return normalized
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export default router;

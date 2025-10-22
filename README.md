# FitFusion

Local-first web app for merging record streams from one FIT file into another while keeping the master ride data intact.

## Features

- Upload master + overlay FIT files, inspect detected record fields, configure merge options, and download a merged FIT.
- Automatic clipping of overlay records to the master ride window with nearest-neighbor alignment.
- Replacement of session/lap `total_moving_time` from the overlay file when enabled.
- Field-level diff report (matched samples, per-field update counts, and power/cadence stats) exposed in the UI and through the API response header.
- Frontend summary refreshes automatically whenever inputs or options change.

## Tech Stack

- **Backend:** Node.js + TypeScript, Express, `fit-file-parser` (decode), `@markw65/fit-file-writer` (encode)
- **Frontend:** Vite + React + TypeScript
- **Testing:** Jest (server merge logic)

## Development Setup

Prerequisites: Node.js 20+, npm.

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../web
npm install
```

### Running the app in development

Run the API (port `3001` by default):

```bash
cd server
npm run dev
```

Run the frontend dev server (port `5173` with proxy to `3001`):

```bash
cd web
npm run dev
```

The React app proxies `/inspect` and `/merge` to `http://localhost:3001`. If your backend lives elsewhere, set `VITE_API_BASE_URL` before starting Vite (or update the `.env` file).

### Tests

Synthetic FIT merge tests live in the server package:

```bash
cd server
npm test
```

### Production build

```bash
cd web
npm run build   # creates web/dist
cd ../server
npm run build   # produces server/dist
```

When the frontend build exists, the Express server serves it from `dist/public` in production.

## Docker

A multi-stage Dockerfile builds the React bundle and the compiled API into a single image. Use `docker compose` to build and run everything behind a single container (serving on `http://localhost:3001`).

```bash
docker compose up --build
```

## API Summary

### `POST /inspect`
- `multipart/form-data` fields: `master` (.fit), `overlay` (.fit), plus optional form fields `toleranceSeconds`, `overlayFields`, `masterFields`, `replaceMovingTime`.
- Returns JSON `MergeReport` preview with record counts, timestamps, clipping info, available field names, and diff stats. No FIT file is produced.

### `POST /merge`
- Same payload as `/inspect`.
- Response: `application/octet-stream` with `Content-Disposition: attachment; filename="merged.fit"`.
- Headers: `X-Merge-Report` contains a base64-encoded JSON `MergeReport` (same shape as `/inspect`).

### Options

| Field | Description | Default |
| --- | --- | --- |
| `toleranceSeconds` | Match window (seconds) for overlay vs master timestamps | `1` |
| `overlayFields` | JSON array of record fields to copy from File 2 into File 1 | `["power","cadence"]` if present in overlay |
| `masterFields` | JSON array of record fields to retain from File 1 (omit for all) | all detected fields |
| `replaceMovingTime` | Replace `session`/`lap` `total_moving_time` with overlay values | `true` |

## Implementation Notes

- The Garmin JS FIT SDK currently ships decode-only tooling; encoding leverages `@markw65/fit-file-writer`.
- Parsing uses `fit-file-parser` in list mode to normalize record/session/lap arrays.
- Overlay data is clipped to the master ride window before performing a two-pointer alignment per the MTB use case.
- Moving time replacement is index-aligned across sessions/laps; other time totals remain untouched.
- Record fields are surfaced from both files so users can whitelist master fields and overlay fields prior to merging.
- All processing happens in-memory per request—no FIT files are persisted to disk beyond runtime buffers.

## Project Structure

```
FitFusion/
├── server/      # Express API, FIT processing logic, tests
├── web/         # React UI (Vite)
├── Dockerfile   # Multi-stage build for combined deployment
└── docker-compose.yml
```
